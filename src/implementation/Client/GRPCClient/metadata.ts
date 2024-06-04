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
  SetMetadataRequest,
} from "../../../proto/dapr/proto/runtime/v1/dapr";
import IClientMetadata from "../../../interfaces/Client/IClientMetadata";
import { GetMetadataResponse as GetMetadataResponseResult } from "../../../types/metadata/GetMetadataResponse";
import { Empty } from "../../../proto/google/protobuf/empty";

// https://docs.dapr.io/reference/api/metadata_api
export default class GRPCClientMetadata implements IClientMetadata {
  client: GRPCClient;

  constructor(client: GRPCClient) {
    this.client = client;
  }

  // There is no gRPC implementation of /healthz, so we try to fetch the metadata
  async get(): Promise<GetMetadataResponseResult> {
    const client = await this.client.getClient();

    return new Promise((resolve, reject) => {
      client.getMetadata(Empty.create(), (err, res) => {
        if (err) {
          return reject(err);
        }

        const wrapped: GetMetadataResponseResult = {
          id: res.id,
          actors: res.activeActorsCount.map((a) => ({
            type: a.type,
            count: a.count,
          })),
          extended: {
            ...res.extendedMetadata,
          },
          components: res.registeredComponents.map((c) => ({
            name: c.name,
            type: c.type,
            version: c.version,
            capabilities: c.capabilities.concat(),
          })),
        };

        return resolve(wrapped);
      });
    });
  }

  async set(key: string, value: string): Promise<boolean> {
    const msg = SetMetadataRequest.create({ key, value });

    const client = await this.client.getClient();

    return new Promise((resolve, reject) => {
      client.setMetadata(msg, (err, _res) => {
        if (err) {
          return reject(false);
        }

        return resolve(true);
      });
    });
  }
}
