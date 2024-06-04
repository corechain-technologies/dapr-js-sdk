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
import { LockResponse as LockResponseResult } from "../../../types/lock/LockResponse";
import { UnlockResponse as UnLockResponseResult, LockStatus } from "../../../types/lock/UnlockResponse";
import {
  TryLockRequest,
  TryLockResponse,
  UnlockRequest,
  UnlockResponse,
  UnlockResponse_Status,
} from "../../../proto/dapr/proto/runtime/v1/dapr";
import IClientLock from "../../../interfaces/Client/IClientLock";

export default class GRPCClientLock implements IClientLock {
  client: GRPCClient;

  constructor(client: GRPCClient) {
    this.client = client;
  }

  async lock(
    storeName: string,
    resourceId: string,
    lockOwner: string,
    expiryInSeconds: number,
  ): Promise<LockResponseResult> {
    const request = TryLockRequest.create({
        storeName,
        resourceId,
        expiryInSeconds,
        lockOwner,
    });

    const client = await this.client.getClient();
    return new Promise((resolve, reject) => {
      client.tryLockAlpha1(request, (err, res: TryLockResponse) => {
        if (err) {
          return reject(err);
        }

        return resolve({
          success: res.success,
        } satisfies LockResponseResult);
      });
    });
  }

  async unlock(storeName: string, resourceId: string, lockOwner: string): Promise<UnLockResponseResult> {
    const request = UnlockRequest.create({
        lockOwner,
        storeName,
        resourceId,
    })

    const client = await this.client.getClient();
    return new Promise((resolve, reject) => {
      client.unlockAlpha1(request, (err, res: UnlockResponse) => {
        if (err) {
          return reject(err);
        }

        const wrapped: UnLockResponseResult = {
          status: this.getUnlockResponse(res),
        };

        return resolve(wrapped);
      });
    });
  }

  getUnlockResponse(res: UnlockResponse) {
    switch (res.status) {
      case UnlockResponse_Status.SUCCESS:
        return LockStatus.Success;
      case UnlockResponse_Status.LOCK_DOES_NOT_EXIST:
        return LockStatus.LockDoesNotExist;
      case UnlockResponse_Status.LOCK_BELONGS_TO_OTHERS:
        return LockStatus.LockBelongsToOthers;
      default:
        return LockStatus.InternalError;
    }
  }
}
