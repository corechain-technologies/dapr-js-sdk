// Code generated by protoc-gen-ts_proto. DO NOT EDIT.
// versions:
//   protoc-gen-ts_proto  v1.176.1
//   protoc               v3.19.1
// source: dapr/proto/internals/v1/apiversion.proto

/* eslint-disable */

export const protobufPackage = "dapr.proto.internals.v1";

/** APIVersion represents the version of Dapr Runtime API. */
export enum APIVersion {
  /** APIVERSION_UNSPECIFIED - unspecified apiversion */
  APIVERSION_UNSPECIFIED = "APIVERSION_UNSPECIFIED",
  /** V1 - Dapr API v1 */
  V1 = "V1",
  UNRECOGNIZED = "UNRECOGNIZED",
}

export function aPIVersionFromJSON(object: any): APIVersion {
  switch (object) {
    case 0:
    case "APIVERSION_UNSPECIFIED":
      return APIVersion.APIVERSION_UNSPECIFIED;
    case 1:
    case "V1":
      return APIVersion.V1;
    case -1:
    case "UNRECOGNIZED":
    default:
      return APIVersion.UNRECOGNIZED;
  }
}

export function aPIVersionToJSON(object: APIVersion): string {
  switch (object) {
    case APIVersion.APIVERSION_UNSPECIFIED:
      return "APIVERSION_UNSPECIFIED";
    case APIVersion.V1:
      return "V1";
    case APIVersion.UNRECOGNIZED:
    default:
      return "UNRECOGNIZED";
  }
}

export function aPIVersionToNumber(object: APIVersion): number {
  switch (object) {
    case APIVersion.APIVERSION_UNSPECIFIED:
      return 0;
    case APIVersion.V1:
      return 1;
    case APIVersion.UNRECOGNIZED:
    default:
      return -1;
  }
}
