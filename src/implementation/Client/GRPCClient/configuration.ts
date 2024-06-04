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
  GetConfigurationRequest,
  SubscribeConfigurationRequest,
  SubscribeConfigurationResponse,
  UnsubscribeConfigurationRequest,
} from "../../../proto/dapr/proto/runtime/v1/dapr";
import IClientConfiguration from "../../../interfaces/Client/IClientConfiguration";
import { KeyValueType } from "../../../types/KeyValue.type";
import { GetConfigurationResponse as GetConfigurationResponseResult } from "../../../types/configuration/GetConfigurationResponse";
import { SubscribeConfigurationResponse as SubscribeConfigurationResponseResult } from "../../../types/configuration/SubscribeConfigurationResponse";
import { SubscribeConfigurationCallback } from "../../../types/configuration/SubscribeConfigurationCallback";
import { SubscribeConfigurationStream } from "../../../types/configuration/SubscribeConfigurationStream";
import { createConfigurationType } from "../../../utils/Client.util";

export default class GRPCClientConfiguration implements IClientConfiguration {
  client: GRPCClient;

  constructor(client: GRPCClient) {
    this.client = client;
  }

  async get(storeName: string, keys: string[], metadataObj?: KeyValueType): Promise<GetConfigurationResponseResult> {
    const msg = GetConfigurationRequest.create({
      storeName,
      keys: keys.filter((i) => i !== ""),
      metadata:  { ...metadataObj },
    });

    const client = await this.client.getClient();

    return new Promise((resolve, reject) => {
      client.getConfiguration(msg, (err, res) => {
        if (err) {
          return reject(err);
        }

        const result: SubscribeConfigurationResponseResult = {
          items: createConfigurationType(res.items),
        };

        return resolve(result);
      });
    });
  }

  async subscribe(storeName: string, cb: SubscribeConfigurationCallback): Promise<SubscribeConfigurationStream> {
    return this._subscribe(storeName, cb);
  }

  async subscribeWithKeys(
    storeName: string,
    keys: string[],
    cb: SubscribeConfigurationCallback,
  ): Promise<SubscribeConfigurationStream> {
    return this._subscribe(storeName, cb, keys);
  }

  async subscribeWithMetadata(
    storeName: string,
    keys: string[],
    metadata: KeyValueType,
    cb: SubscribeConfigurationCallback,
  ): Promise<SubscribeConfigurationStream> {
    return this._subscribe(storeName, cb, keys, metadata);
  }

  async _subscribe(
    storeName: string,
    cb: SubscribeConfigurationCallback,
    keys?: string[],
    metadataObj?: KeyValueType,
  ): Promise<SubscribeConfigurationStream> {
    const msg = SubscribeConfigurationRequest.create({
        storeName,
        keys: keys?.concat(),
        metadata: { ...metadataObj },
    });

    const client = await this.client.getClient();

    // Open a stream. Note that this is a never-ending stream
    // and will stay open as long as the client is open
    // we will thus create a set with our listeners so we don't
    // break on multi listeners
    const stream = client.subscribeConfiguration(msg);
    let streamId: string;

    stream.on("data", async (data: SubscribeConfigurationResponse) => {
      streamId = data.id;
      const items = data.items;

      if (Object.keys(items).length === 0) {
        return;
      }

      const wrapped: SubscribeConfigurationResponseResult = {
        items: createConfigurationType(items),
      };

      await cb(wrapped);
    });

    return {
      stop: async () => {
        return new Promise((resolve, reject) => {
          const req = UnsubscribeConfigurationRequest.create({
            storeName,
            id: streamId,
          });

          client.unsubscribeConfiguration(req, (err, res) => {
            if (err || !res.ok) {
              return reject(res.message);
            }

            // Clean up the node.js event emitter
            stream.removeAllListeners();
            stream.destroy();

            return resolve();
          });
        });
      },
    };
  }
}
