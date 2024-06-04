/*
Copyright 2022 The Dapr Authors
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import * as grpc from "@grpc/grpc-js";
import { Any } from "../../../proto/google/protobuf/any";
import { Empty } from "../../../proto/google/protobuf/empty";

import { AppCallbackServer, TopicEventResponse_TopicEventResponseStatus } from "../../../proto/dapr/proto/runtime/v1/appcallback";
import { HTTPExtension_Verb, InvokeRequest, InvokeResponse } from "../../../proto/dapr/proto/common/v1/common";
import {
  BindingEventRequest,
  BindingEventResponse,
  BulkSubscribeConfig,
  ListInputBindingsResponse,
  ListTopicSubscriptionsResponse,
  TopicEventRequest,
  TopicEventResponse,
  TopicRoutes,
  TopicRule,
  TopicSubscription,
  TopicEventBulkRequest,
  TopicEventBulkResponse,
  TopicEventBulkResponseEntry,
} from "../../../proto/dapr/proto/runtime/v1/appcallback";
import * as HttpVerbUtil from "../../../utils/HttpVerb.util";
import { TypeDaprBindingCallback } from "../../../types/DaprBindingCallback.type";
import { TypeDaprPubSubCallback } from "../../../types/DaprPubSubCallback.type";
import { Logger } from "../../../logger/Logger";
import { LoggerOptions } from "../../../types/logger/LoggerOptions";
import { PubSubSubscriptionOptionsType } from "../../../types/pubsub/PubSubSubscriptionOptions.type";
import { IServerType } from "./GRPCServer";
import { DaprInvokerCallbackFunction } from "../../../types/DaprInvokerCallback.type";
import { PubSubSubscriptionTopicRouteType } from "../../../types/pubsub/PubSubSubscriptionTopicRoute.type";
import DaprPubSubStatusEnum from "../../../enum/DaprPubSubStatus.enum";
import { deserializeGrpc } from "../../../utils/Deserializer.util";
import { Settings } from "../../../utils/Settings.util";
import { SubscriptionManager } from "../../../pubsub/subscriptionManager";
import { PubSubSubscriptionsType } from "../../../types/pubsub/PubSubSubscriptions.type";

// https://github.com/badsyntax/grpc-js-typescript/issues/1#issuecomment-705419742
// @ts-ignore
export default class GRPCServerImpl implements AppCallbackServer {
  private readonly logger: Logger;
  private readonly subscriptionManager: SubscriptionManager;

  handlersInvoke: { [key: string]: DaprInvokerCallbackFunction };
  handlersBindings: { [key: string]: TypeDaprBindingCallback };

  constructor(_server: IServerType, loggerOptions?: LoggerOptions) {
    this.logger = new Logger("GRPCServer", "GRPCServerImpl", loggerOptions);
    this.subscriptionManager = new SubscriptionManager();

    this.handlersInvoke = {};
    this.handlersBindings = {};
  }

  createInputBindingHandlerKey(bindingName: string): string {
    return `${bindingName.toLowerCase()}`;
  }

  createOnInvokeHandlerKey(httpMethod: string, methodName: string): string {
    return `${httpMethod.toLowerCase()}|${methodName.toLowerCase()}`;
  }

  registerOnInvokeHandler(httpMethod: string, methodName: string, cb: DaprInvokerCallbackFunction): void {
    const handlerKey = this.createOnInvokeHandlerKey(httpMethod, methodName);
    this.handlersInvoke[handlerKey] = cb;
  }

  /**
   * When we subscribe, we subscribe to a topic
   * For this topic we can define "routes" which route to a certain callback depending on the event content
   * Each of these topics are handled by a EventHandler but there can be multiple handlers per pubsubname-topic-route combination
   *
   * We don't create the EventHandlers here but we ensure that the routes are registered and can receive POST events
   * -> we create POST /<route> endpoints for each, but we create them uniquely!
   * -> to ensure uniqueness, we just check if this.pubsubRouteEventHandlers[route] is set
   *
   * @param pubSubName
   * @param topicName
   * @param cb
   * @param options
   */
  registerPubsubSubscription(pubsubName: string, topic: string, options: PubSubSubscriptionOptionsType = {}): void {
    this.subscriptionManager.registerSubscription(pubsubName, topic, options);

    this.logger.info(
      `[Topic = ${topic}] Registered Subscription with routes: ${Object.keys(
        this.subscriptionManager.getSubscription(pubsubName, topic).routes,
      ).join(", ")}`,
    );
  }

  registerPubSubSubscriptionEventHandler(
    pubsubName: string,
    topic: string,
    route: string | undefined,
    cb: TypeDaprPubSubCallback,
  ): void {
    this.subscriptionManager.addEventHandlerToSubscription(pubsubName, topic, cb, route);
  }

  registerInputBindingHandler(bindingName: string, cb: DaprInvokerCallbackFunction): void {
    const handlerKey = this.createInputBindingHandlerKey(bindingName);
    this.handlersBindings[handlerKey] = cb;
  }

  getSubscriptions(): PubSubSubscriptionsType {
    return this.subscriptionManager.getSubscriptions();
  }

  // '(call: ServerUnaryCall<InvokeRequest, InvokeResponse>, callback: sendUnaryData<InvokeResponse>) => Promise<...>'
  // handleUnaryCall<InvokeRequest, InvokeResponse>'.

  async onInvoke(
    call: grpc.ServerUnaryCall<InvokeRequest, InvokeResponse>,
    callback: grpc.sendUnaryData<InvokeResponse>,
  ): Promise<void> {
    const method = call.request.method;
    const query = call.request.httpExtension;
    const methodStr = HttpVerbUtil.convertHttpVerbNumberToString(query?.verb ?? HTTPExtension_Verb.NONE);
    const handlersInvokeKey = `${methodStr.toLowerCase()}|${method.toLowerCase()}`;

    if (!this.handlersInvoke[handlersInvokeKey]) {
      this.logger.warn(`${methodStr} /${method} was not handled`);
      return;
    }

    const body = Buffer.from(call.request.data?.value ?? "").toString();
    const contentType = call.request.contentType;

    // Invoke the Method Callback
    // @TODO add call.metadata, it has headers of original HTTP request.
    const invokeResponseData = await this.handlersInvoke[handlersInvokeKey]({
      body,
      query: query?.querystring,
      metadata: {
        contentType,
      },
    });

    // Generate Response
    const res = InvokeResponse.create({
        contentType: "application/json"
    });

    if (invokeResponseData) {
      res.data = Any.create({
        value: Buffer.from(JSON.stringify(invokeResponseData), "utf-8"),
      });
    }
    // @TODO add Error Handleling, for ex if service returned error with status code
    // also maybe we can map GRPC error codes in a enum

    return callback(null, res);
  }

  // @todo: WIP
  async onBindingEvent(
    call: grpc.ServerUnaryCall<BindingEventRequest, BindingEventResponse>,
    callback: grpc.sendUnaryData<BindingEventResponse>,
  ): Promise<void> {
    const req = call.request;
    const handlerKey = this.createInputBindingHandlerKey(req.name);

    if (!this.handlersBindings[handlerKey]) {
      this.logger.warn(`Event for binding: "${handlerKey}" was not handled`);
      return;
    }

    const data = Buffer.from(req.data).toString();

    let dataParsed;

    try {
      dataParsed = JSON.parse(data);
    } catch (e) {
      dataParsed = data;
    }

    await this.handlersBindings[handlerKey](dataParsed);

    // @todo: we should add the state store or output binding binding
    // see: https://docs.dapr.io/reference/api/bindings_api/#binding-endpoints
    return callback(null, BindingEventResponse.create());
  }

  async onTopicEvent(
    call: grpc.ServerUnaryCall<TopicEventRequest, TopicEventResponse>,
    callback: grpc.sendUnaryData<TopicEventResponse>,
  ): Promise<void> {
    const req = call.request;
    const pubsub = req.pubsubName;

    if (!this.subscriptionManager.isPubSubRegistered(pubsub)) {
      this.logger.warn(`PubSub '${pubsub}' has not been registered, ignoring event.`);
      return;
    }

    const [topic, route] = this.subscriptionManager.lookupTopicWilcard(pubsub, req.topic, req.path);
    if (topic == "") {
      this.logger.warn(`Topic '${topic}' has not been subscribed to pubsub '${pubsub}', ignoring event.`);
      return;
    }

    const subscription = this.subscriptionManager.getSubscription(pubsub, topic);
    if (!subscription.routes[route]) {
      this.logger.warn(
        `Route '${route}' has not been subscribed to topic '${topic}' on pubsub '${pubsub}', ignoring event.`,
      );
      return;
    }

    const data = deserializeGrpc(req.dataContentType, req.data);

    const res = TopicEventResponse.create();

    // Get the headers
    const headers: { [key: string]: string } = {};

    for (const [key, value] of Object.entries(call.metadata.toHttp2Headers())) {
      if (value) {
        headers[key] = value.toString();
      }
    }

    // Process the callbacks
    // we handle priority of status on `RETRY` > `DROP` > `SUCCESS` and default to `SUCCESS`
    const routeObj = subscription.routes[route];
    const status = await this.processPubSubCallbacks(routeObj, data, headers);

    switch (status) {
      case DaprPubSubStatusEnum.RETRY:
        res.status = TopicEventResponse_TopicEventResponseStatus.RETRY;
        break;
      case DaprPubSubStatusEnum.DROP:
        res.status = TopicEventResponse_TopicEventResponseStatus.DROP;
        break;
      case DaprPubSubStatusEnum.SUCCESS:
      default:
        res.status = TopicEventResponse_TopicEventResponseStatus.SUCCESS;
        break;
    }

    return callback(null, res);
  }

  async onBulkTopicEventAlpha1(
    call: grpc.ServerUnaryCall<TopicEventBulkRequest, TopicEventBulkResponse>,
    callback: grpc.sendUnaryData<TopicEventBulkResponse>,
  ): Promise<void> {
    const req = call.request;
    const pubsub = req.pubsubName;
    if (!this.subscriptionManager.isPubSubRegistered(pubsub)) {
      this.logger.warn(`PubSub '${pubsub}' has not been registered, ignoring bulk event.`);
      return;
    }

    const [topic, route] = this.subscriptionManager.lookupTopicWilcard(pubsub, req.topic, req.path);
    if (topic == "") {
      this.logger.warn(`Topic '${topic}' has not been subscribed to pubsub '${pubsub}', ignoring bulk event.`);
      return;
    }

    const subscription = this.subscriptionManager.getSubscription(pubsub, topic);
    if (!subscription.routes[route]) {
      this.logger.warn(
        `Route '${route}' has not been subscribed to topic '${topic}' on pubsub '${pubsub}', ignoring bulk event.`,
      );
      return;
    }

    const resArr: TopicEventBulkResponseEntry[] = [];
    const entries = req.entries;

    for (const ind in entries) {
      const event = entries[ind];
      let data: any;
      if (event.bytes) {
        data = deserializeGrpc(event.contentType, event.bytes);
      } else if (event.cloudEvent) {
        data = deserializeGrpc(event.cloudEvent.dataContentType, event.cloudEvent.data);
      }

      const res = TopicEventBulkResponseEntry.create();

      // Get the headers
      const headers: { [key: string]: string } = {};

      for (const [key, value] of Object.entries(call.metadata.toHttp2Headers())) {
        if (value) {
          headers[key] = value.toString();
        }
      }

      // Process the callbacks
      // we handle priority of status on `RETRY` > `DROP` > `SUCCESS` and default to `SUCCESS`
      const routeObj = subscription.routes[route];
      const status = await this.processPubSubCallbacks(routeObj, data, headers);

      switch (status) {
        case DaprPubSubStatusEnum.RETRY:
          res.status = TopicEventResponse_TopicEventResponseStatus.RETRY;
          break;
        case DaprPubSubStatusEnum.DROP:
          res.status = TopicEventResponse_TopicEventResponseStatus.DROP;
          break;
        case DaprPubSubStatusEnum.SUCCESS:
        default:
          res.status = TopicEventResponse_TopicEventResponseStatus.SUCCESS;
          break;
      }

      res.entryId = event.entryId;
      resArr.push(res);
    }

    const totalRes = TopicEventBulkResponse.create({ statuses: resArr });

    return callback(null, totalRes);
  }

  async processPubSubCallbacks(
    routeObj: PubSubSubscriptionTopicRouteType,
    data: any,
    headers: { [key: string]: string },
  ): Promise<DaprPubSubStatusEnum> {
    const eventHandlers = routeObj.eventHandlers;
    const statuses = [];

    // Process the callbacks (default: SUCCESS)
    for (const cb of eventHandlers) {
      let status = DaprPubSubStatusEnum.SUCCESS;

      try {
        status = await cb(data, headers);
      } catch (e) {
        // We catch and log an error, but we don't do anything with it as the statuses should define that
        this.logger.error(`[route - ${routeObj.path}]Message processing failed, ${e}`);
      }

      statuses.push(status ?? DaprPubSubStatusEnum.SUCCESS);
    }

    // Look at the statuses and return the highest priority
    // we handle priority of status on `RETRY` > `DROP` > `SUCCESS`
    if (statuses.includes(DaprPubSubStatusEnum.RETRY)) {
      this.logger.debug(`[route - ${routeObj.path}]Retrying message`);
      return DaprPubSubStatusEnum.RETRY;
    } else if (statuses.includes(DaprPubSubStatusEnum.DROP)) {
      this.logger.debug(`[route - ${routeObj.path}]Dropping message`);
      return DaprPubSubStatusEnum.DROP;
    } else {
      this.logger.debug(`[route - ${routeObj.path}]Acknowledging message`);
      return DaprPubSubStatusEnum.SUCCESS;
    }
  }

  // Dapr will call this on startup to see which topics it is subscribed to
  async listTopicSubscriptions(
    call: grpc.ServerUnaryCall<Empty, ListTopicSubscriptionsResponse>,
    callback: grpc.sendUnaryData<ListTopicSubscriptionsResponse>,
  ): Promise<void> {
    const res = ListTopicSubscriptionsResponse.create();
    const subscriptions = [];

    for (const pubsub of this.subscriptionManager.getRegisteredPubSubs()) {
      for (const topic of this.subscriptionManager.getRegisteredTopics(pubsub)) {
        const topicSubscription = TopicSubscription.create({ pubsubName: pubsub, topic });

        // Dapr routes
        const daprConfig = this.subscriptionManager.getSubscription(pubsub, topic).dapr;

        if (daprConfig?.deadLetterTopic) {
          topicSubscription.deadLetterTopic = daprConfig.deadLetterTopic;
        }

        if (daprConfig?.bulkSubscribe) {
          const bulkSubscribe = BulkSubscribeConfig.create({
            enabled: daprConfig.bulkSubscribe.enabled,
          });

          if (daprConfig?.bulkSubscribe?.maxMessagesCount) {
            bulkSubscribe.maxMessagesCount = daprConfig.bulkSubscribe.maxMessagesCount;
          }

          if (daprConfig?.bulkSubscribe?.maxAwaitDurationMs) {
            bulkSubscribe.maxAwaitDurationMs = daprConfig.bulkSubscribe.maxAwaitDurationMs;
          }

          topicSubscription.bulkSubscribe = bulkSubscribe;
        }

        if (daprConfig?.metadata) {
          topicSubscription.metadata = {
            ...topicSubscription.metadata,
            ...daprConfig.metadata,
          }
        }

        if (daprConfig?.routes) {
          const routes = TopicRoutes.create();

          if (daprConfig?.routes?.default) {
            routes.default = daprConfig?.routes?.default;
          }

          if (daprConfig?.routes?.rules) {
            for (const ruleItem of daprConfig.routes.rules) {
              const rule = TopicRule.create({
                match: ruleItem.match,
                path: ruleItem.path,
              });
              routes.rules.push(rule);
            }
          }

          topicSubscription.routes = routes;
        } else {
          topicSubscription.routes = TopicRoutes.create({
            default: daprConfig?.route || Settings.getDefaultPubSubRouteName(),
          });
        }

        subscriptions.push(topicSubscription);
      }
    }

    res.subscriptions = subscriptions;

    return callback(null, res);
  }

  // @todo: WIP
  async listInputBindings(
    call: grpc.ServerUnaryCall<Empty, ListInputBindingsResponse>,
    callback: grpc.sendUnaryData<ListInputBindingsResponse>,
  ): Promise<void> {
    return callback(null, ListInputBindingsResponse.create({
        bindings: Object.keys(this.handlersBindings),
    }));
  }
}
