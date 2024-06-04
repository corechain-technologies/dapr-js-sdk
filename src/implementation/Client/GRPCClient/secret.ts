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
  GetBulkSecretRequest,
  GetBulkSecretResponse,
  GetSecretRequest,
} from "../../../proto/dapr/proto/runtime/v1/dapr";
import IClientSecret from "../../../interfaces/Client/IClientSecret";

// https://docs.dapr.io/reference/api/secrets_api/
export default class GRPCClientSecret implements IClientSecret {
  client: GRPCClient;

  constructor(client: GRPCClient) {
    this.client = client;
  }

  // @todo: implement metadata
  async get(secretStoreName: string, key: string, _metadata = ""): Promise<object> {
    const msgService = GetSecretRequest.create({ storeName: secretStoreName, key });

    const client = await this.client.getClient();

    return new Promise((resolve, reject) => {
      client.getSecret(msgService, (err, res) => {
        if (err) {
          return reject(err);
        }

        return resolve(res.data);
      });
    });
  }

  async getBulk(secretStoreName: string): Promise<object> {
    const msgService = GetBulkSecretRequest.create({
        storeName: secretStoreName,
    });

    const client = await this.client.getClient();

    return new Promise((resolve, reject) => {
      client.getBulkSecret(msgService, (err, res) => {
        if (err) {
          return reject(err);
        }

        return resolve(res.data);
      });
    });
  }
}
