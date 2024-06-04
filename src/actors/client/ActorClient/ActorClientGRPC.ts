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

// import { Any } from "google-protobuf/google/protobuf/any_pb";
import { Any } from "../../../proto/google/protobuf/any";
import {
  ExecuteActorStateTransactionRequest,
  GetActorStateRequest,
  GetActorStateResponse,
  GetMetadataResponse,
  InvokeActorRequest,
  RegisterActorReminderRequest,
  RegisterActorTimerRequest,
  TransactionalActorStateOperation,
  UnregisterActorReminderRequest,
  UnregisterActorTimerRequest,
} from "../../../proto/dapr/proto/runtime/v1/dapr";

import GRPCClient from "../../../implementation/Client/GRPCClient/GRPCClient";
import { OperationType } from "../../../types/Operation.type";
import { ActorReminderType } from "../../../types/ActorReminder.type";
import { ActorTimerType } from "../../../types/ActorTimer.type";
import IClientActor from "../../../interfaces/Client/IClientActor";
import { KeyValueType } from "../../../types/KeyValue.type";
import ActorId from "../../ActorId";
import { Empty } from "../../../proto/google/protobuf/empty";

// https://docs.dapr.io/reference/api/actors_api/
export default class ActorClientGRPC implements IClientActor {
  client: GRPCClient;

  constructor(client: GRPCClient) {
    this.client = client;
  }

  async invoke(actorType: string, actorId: ActorId, methodName: string, body?: any): Promise<object> {
    const msgService = InvokeActorRequest.create({
        actorId: actorId.getId(),
        actorType,
        method: methodName,
        data: body,
    });

    const client = await this.client.getClient();

    return new Promise((resolve, reject) => {
      client.invokeActor(msgService, (err, res) => {
        if (err) {
          return reject(err);
        }

        // https://docs.dapr.io/reference/api/secrets_api/#response-body
        const resData = Buffer.from(res.data).toString();

        try {
          return resolve(JSON.parse(resData));
        } catch (e) {
          return resolve(resData as any);
        }
      });
    });
  }

  async stateTransaction(actorType: string, actorId: ActorId, operations: OperationType[]): Promise<void> {
    const transactionItems: TransactionalActorStateOperation[] = operations.map((o) => TransactionalActorStateOperation.create({
      key: o.request.key,
      operationType: o.operation,
      value: Any.create({
        value: o.request.value,
      }),
    }));

    const msgService = ExecuteActorStateTransactionRequest.create({
        actorId: actorId.getId(),
        actorType,
        operations: transactionItems,
    });

    const client = await this.client.getClient();

    return new Promise((resolve, reject) => {
      client.executeActorStateTransaction(msgService, (err, _res) => {
        if (err) {
          return reject(err);
        }

        // https://docs.dapr.io/reference/api/state_api/#request-body-1
        return resolve();
      });
    });
  }

  async stateGet(actorType: string, actorId: ActorId, key: string): Promise<KeyValueType | string> {
    const msgService = GetActorStateRequest.create({
        actorId: actorId.getId(),
        actorType,
        key,
    });

    const client = await this.client.getClient();

    return new Promise((resolve, reject) => {
      client.getActorState(msgService, (err, res: GetActorStateResponse) => {
        if (err) {
          return reject(err);
        }
 
        // https://docs.dapr.io/reference/api/actors_api/#http-response-codes-2
        const resData = Buffer.from(res.data).toString();

        try {
          const json = JSON.parse(resData);
          return resolve(json);
        } catch (e) {
          return resolve(resData);
        }
      });
    });
  }

  async registerActorReminder(
    actorType: string,
    actorId: ActorId,
    name: string,
    reminder: ActorReminderType,
  ): Promise<void> {
    const msgService = RegisterActorReminderRequest.create({
        actorType,
        actorId: actorId.getId(),
        name,
        data: reminder.data,
        period: reminder.period?.toJSON() ?? undefined,
        dueTime: reminder.dueTime?.toString() ?? undefined,
        ttl: reminder.ttl?.toString() ?? undefined,
    });

    const client = await this.client.getClient();

    return new Promise((resolve, reject) => {
      client.registerActorReminder(msgService, (err, _res) => {
        if (err) {
          return reject(err);
        }

        // https://docs.dapr.io/reference/api/actors_api/#http-response-codes-3
        return resolve();
      });
    });
  }

  async unregisterActorReminder(actorType: string, actorId: ActorId, name: string): Promise<void> {
    const msgService = UnregisterActorReminderRequest.create({
        actorType,
        actorId: actorId.getId(),
        name,
    });

    const client = await this.client.getClient();

    return new Promise((resolve, reject) => {
      client.unregisterActorReminder(msgService, (err, _res) => {
        if (err) {
          return reject(err);
        }

        // https://docs.dapr.io/reference/api/actors_api/#delete-actor-reminder
        return resolve();
      });
    });
  }

  async registerActorTimer(actorType: string, actorId: ActorId, name: string, timer: ActorTimerType): Promise<void> {
    const msgService = RegisterActorTimerRequest.create({
        actorType,
        actorId: actorId.getId(),
        name,
        callback: timer.callback,
        data: timer.data,
        period: timer.period?.toString() ?? undefined,
        dueTime: timer.dueTime?.toString() ?? undefined,
        ttl: timer.ttl?.toString() ?? undefined,
    });

    const client = await this.client.getClient();

    return new Promise((resolve, reject) => {
      client.registerActorTimer(msgService, (err, _res) => {
        if (err) {
          return reject(err);
        }

        // https://docs.dapr.io/reference/api/actors_api/#http-response-codes-3
        return resolve();
      });
    });
  }

  async unregisterActorTimer(actorType: string, actorId: ActorId, name: string): Promise<void> {
    const msgService = UnregisterActorTimerRequest.create({
        actorType,
        actorId: actorId.getId(),
        name,
    });

    const client = await this.client.getClient();

    return new Promise((resolve, reject) => {
      client.unregisterActorTimer(msgService, (err, _res) => {
        if (err) {
          return reject(err);
        }

        // https://docs.dapr.io/reference/api/actors_api/#delete-actor-timer
        return resolve();
      });
    });
  }

  // @todo: cannot find this one
  // async deactivate(actorType: string, actorId: string): Promise<ResActorDeactivateDto> {
  //     const msgService = new UnregisterActorTimerRequest();
  //     msgService.setActorType(actorType);
  //     msgService.setActorId(actorId);
  //     msgService.setName(name);

  //     return new Promise(async (resolve, reject) => {
  //         const client = await GRPCClientSingleton.getClient();
  //         client.unregisterActorTimer(msgService, (err, res) => {
  //             if (err) {
  //                 return reject(err);
  //             }

  //             // https://docs.dapr.io/reference/api/actors_api/#delete-actor-timer
  //             return resolve();
  //         });
  //     });
  // }

  async getActors(): Promise<object> {
    const client = await this.client.getClient();

    return new Promise((resolve, reject) => {
      client.getMetadata(Empty.create(), (err, res: GetMetadataResponse) => {
        if (err) {
          return reject(err);
        }

        // https://docs.dapr.io/reference/api/actors_api/#http-response-codes-2
        return resolve(res.activeActorsCount);
      });
    });
  }
}
