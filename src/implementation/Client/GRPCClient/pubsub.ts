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

import GRPCClient from "./GRPCClient";
import {
  BulkPublishRequest,
  BulkPublishRequestEntry,
  PublishEventRequest,
} from "../../../proto/dapr/proto/runtime/v1/dapr";
import IClientPubSub from "../../../interfaces/Client/IClientPubSub";
import { Logger } from "../../../logger/Logger";
import * as SerializerUtil from "../../../utils/Serializer.util";
import { KeyValueType } from "../../../types/KeyValue.type";
import { getBulkPublishEntries, getBulkPublishResponse } from "../../../utils/Client.util";
import { PubSubPublishResponseType } from "../../../types/pubsub/PubSubPublishResponse.type";
import { PubSubBulkPublishResponse } from "../../../types/pubsub/PubSubBulkPublishResponse.type";
import { PubSubBulkPublishMessage } from "../../../types/pubsub/PubSubBulkPublishMessage.type";
import { PubSubPublishOptions } from "../../../types/pubsub/PubSubPublishOptions.type";

// https://docs.dapr.io/reference/api/pubsub_api/
export default class GRPCClientPubSub implements IClientPubSub {
  client: GRPCClient;

  private readonly logger: Logger;

  constructor(client: GRPCClient) {
    this.client = client;
    this.logger = new Logger("GRPCClient", "PubSub", client.options.logger);
  }

  async publish(
    pubsubName: string,
    topic: string,
    data: object | string,
    options: PubSubPublishOptions = {},
  ): Promise<PubSubPublishResponseType> {
    const msgService = PublishEventRequest.create({ pubsubName, topic });

    if (data) {
      const serialized = SerializerUtil.serializeGrpc(data, options.contentType);
      msgService.data = serialized.serializedData;
      msgService.dataContentType = serialized.contentType;
    }

    msgService.metadata = {
        ...msgService.metadata,
        ...options.metadata,
    };

    const client = await this.client.getClient();
    return new Promise((resolve, reject) => {
      client.publishEvent(msgService, (err, _res) => {
        if (err) {
          this.logger.error(`publish failed: ${err}`);
          return reject({ error: err });
        }

        return resolve({});
      });
    });
  }

  async publishBulk(
    pubsubName: string,
    topic: string,
    messages: PubSubBulkPublishMessage[],
    metadata?: KeyValueType | undefined,
  ): Promise<PubSubBulkPublishResponse> {
    const bulkPublishRequest = BulkPublishRequest.create({ pubsubName, topic });

    const entries = getBulkPublishEntries(messages);
    const serializedEntries = entries.map((entry) => {
      const serialized = SerializerUtil.serializeGrpc(entry.event);
      return BulkPublishRequestEntry.create({
            event: serialized.serializedData,
            contentType: serialized.contentType,
            entryId: entry.entryID,
      });
    });

    bulkPublishRequest.entries = serializedEntries.concat();
    bulkPublishRequest.metadata = {
        ...bulkPublishRequest.metadata,
        ...metadata,
    }

    const client = await this.client.getClient();
    return new Promise((resolve, _reject) => {
      client.bulkPublishEventAlpha1(bulkPublishRequest, (err, res) => {
        if (err) {
          return resolve(getBulkPublishResponse({ entries: entries, error: err }));
        }

        const failedEntries = res.failedEntries;
        if (failedEntries.length > 0) {
          return resolve(
            getBulkPublishResponse({
              entries: entries,
              response: {
                failedEntries: failedEntries.map((entry) => ({
                  entryID: entry.entryId,
                  error: entry.error,
                })),
              },
            }),
          );
        }

        return resolve({ failedMessages: [] });
      });
    });
  }
}
