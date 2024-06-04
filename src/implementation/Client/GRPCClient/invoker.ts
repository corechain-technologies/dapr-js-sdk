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

import { HttpMethod } from "../../../enum/HttpMethod.enum";
import { HTTPExtension, InvokeRequest } from "../../../proto/dapr/proto/common/v1/common";
import { InvokeServiceRequest } from "../../../proto/dapr/proto/runtime/v1/dapr";
import * as HttpVerbUtil from "../../../utils/HttpVerb.util";
import IClientInvoker from "../../../interfaces/Client/IClientInvoker";
import * as SerializerUtil from "../../../utils/Serializer.util";
import { InvokerOptions } from "../../../types/InvokerOptions.type";
import { Any } from "../../../proto/google/protobuf/any";

// https://docs.dapr.io/reference/api/service_invocation_api/
export default class GRPCClientInvoker implements IClientInvoker {
  client: GRPCClient;

  constructor(client: GRPCClient) {
    this.client = client;
  }

  // @todo: should return a specific typed Promise<TypeInvokerInvokeResponse> instead of Promise<nothing>

  async invoke(
    appId: string,
    methodName: string,
    method: HttpMethod = HttpMethod.GET,
    data: object = {},
    _options: InvokerOptions = {},
  ): Promise<object> {
    // InvokeServiceRequest represents the request message for Service invocation.
    const { serializedData, contentType } = SerializerUtil.serializeGrpc(data);

    const msgInvokeService = InvokeServiceRequest.create({
      id: appId,
      message: InvokeRequest.create({
        method: methodName,
        httpExtension: HTTPExtension.create({
          verb: HttpVerbUtil.convertHttpVerbStringToNumber(method),
        }),
        contentType,
        data: Any.create({ value: serializedData }),
      }),
    });

    const client = await this.client.getClient();

    return new Promise((resolve, reject) => {
      client.invokeService(msgInvokeService, (err, res) => {
        if (err) {
          return reject(err);
        }

        let resData = "";

        if (res.data) {
          resData = Buffer.from(res.data.value).toString();
        }

        try {
          const parsedResData = JSON.parse(resData);
          return resolve(parsedResData);
        } catch (e) {
          throw new Error(
            JSON.stringify({
              error: "COULD_NOT_PARSE_RESULT",
              error_msg: `Could not parse the returned resultset: ${resData}`,
            }),
          );
        }
      });
    });
  }
}
