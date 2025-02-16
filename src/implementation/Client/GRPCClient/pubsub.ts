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

import GRPCClient from './GRPCClient';
import { PublishEventRequest } from "../../../proto/dapr/proto/runtime/v1/dapr_pb";
import IClientPubSub from "../../../interfaces/Client/IClientPubSub";

// https://docs.dapr.io/reference/api/pubsub_api/
export default class GRPCClientPubSub implements IClientPubSub {
  client: GRPCClient;

  constructor(client: GRPCClient) {
    this.client = client;
  }

  // @todo: should return a specific typed Promise<TypePubSubPublishResponse> instead of Promise<any>
  async publish(pubSubName: string, topic: string, data: object = {}): Promise<boolean> {
    const msgService = new PublishEventRequest();
    msgService.setPubsubName(pubSubName);
    msgService.setTopic(topic);
    msgService.setData(Buffer.from(JSON.stringify(data), "utf-8"));

    return new Promise((resolve, reject) => {
      const client = this.client.getClient();
      client.publishEvent(msgService, (err, _res) => {
        if (err) {
          console.error(err);
          return reject(false);
        }

        // https://docs.dapr.io/reference/api/pubsub_api/#expected-http-response
        return resolve(true);
      });
    });
  }
}
