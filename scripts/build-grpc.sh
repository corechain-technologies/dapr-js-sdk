#!/usr/bin/env bash
#
# Copyright 2022 The Dapr Authors
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#     http://www.apache.org/licenses/LICENSE-2.0
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# OS="$(uname | tr '[:upper:]' '[:lower:]')"
# ARCH="$(uname -m)"

# Proto buf generation
# APPCALLBACK="appcallback"
# COMMON="common"
# DAPR="dapr"
# RUNTIME="runtime"
# GOOGLE_ANY="runtime"

# Path to store output
PATH_ROOT="$(realpath "$(dirname "${BASH_SOURCE[0]}")/..")"

# Http request CLI
HTTP_REQUEST_CLI=curl

# Make sure curl or wget are installed
prerequisiteCheckHttpRequestCLI() {
	if type "curl" > /dev/null; then
		HTTP_REQUEST_CLI=curl
	elif type "wget" > /dev/null; then
		HTTP_REQUEST_CLI=wget
	else
		echo "Either curl or wget is required"
		exit 1
	fi
}

prerequisiteCheckProtobuf() {
	if ! type "protoc" > /dev/null; then
		echo "protoc is not installed, trying to install"
		sudo apt update
		sudo apt install -y protobuf-compiler
		protoc --version

		prerequisiteCheckProtobuf
	else
		echo "protoc ($(protoc --version)) installed"
	fi
}

downloadFile() {
	SRC=$1
	DST=$2

	# Ensure target path exists
	mkdir -p "$(dirname "$DST")"

	# Download the file
	echo "[$HTTP_REQUEST_CLI] Downloading $1 ..."
	if [ "$HTTP_REQUEST_CLI" == "curl" ]; then
		curl -SsL "$SRC" -o "$DST"
	else
		wget -q -P "$SRC" "$DST"
	fi
	echo "[$HTTP_REQUEST_CLI] Saved to $DST"
}

generateGrpc() {
	PATH_PROTO=$1
	PATH_FILE=$2

	echo "[protoc] Generating RPC for $PATH_PROTO/$PATH_FILE"

	mkdir -p "${PATH_ROOT}/output"

	"${PATH_ROOT}/node_modules/.bin/grpc_tools_node_protoc" \
		--plugin=ts_proto="${PATH_ROOT}/node_modules/.bin/protoc-gen-ts_proto" \
		--ts_proto_out="${PATH_ROOT}/output" \
		-I="${PATH_PROTO}" \
		"${PATH_PROTO}/${PATH_FILE}"

	# Tools to be installed by npm (see package.json)
	# PROTOC_GEN_TS_PATH="${PATH_ROOT}/node_modules/.bin/protoc-gen-ts"
	# PROTOC_GEN_GRPC_PATH="${PATH_ROOT}/node_modules/.bin/grpc_tools_node_protoc_plugin"

	# Note: we specify --proto_path to show where we should start searching from. If we use import it will start from this path
	# this is why PATH_PROTO != PATH_PROTO_DAPR; PATH_PROTO_DAPR is where we save our proto files while the other is the namespace
	# protoc \
	#     --proto_path="${PATH_PROTO}" \
	#     --plugin="protoc-gen-ts=${PROTOC_GEN_TS_PATH}" \
	#     --plugin=protoc-gen-grpc=${PROTOC_GEN_GRPC_PATH} \
	#     --js_out="import_style=commonjs,binary:$PATH_PROTO" \
	#     --ts_out="grpc_js:$PATH_PROTO" \
	#     --grpc_out="grpc_js:$PATH_PROTO" \
	#     "$PATH_PROTO/$PATH_FILE"
}

# fail_trap() {
# 	result=$?
# 	if [ $result != 0 ]; then
# 		echo "Failed to generate gRPC interface and proto buf: $ret_val"
# 	fi
# 	cleanup
# 	exit $result
# }

cleanup() {
	find $PATH_PROTO -type f -name '*.proto' -delete
	rm -rf protoc
	rm -f protoc.zip
}

generateGrpcSuccess() {
	echo -e "\ngRPC interface and proto buf generated successfully!"
}

# -----------------------------------------------------------------------------
# main
# -----------------------------------------------------------------------------
#trap "fail_trap" EXIT

echo "Checking Dependencies"
prerequisiteCheckProtobuf
prerequisiteCheckHttpRequestCLI

# echo ""
# echo "Removing old Proto Files"
# rm -rf "$PATH_ROOT/src/proto"
# mkdir -p "$PATH_ROOT/src/proto"

# echo ""
# echo "Downloading latest Dapr gRPC files"
# downloadFile "https://raw.githubusercontent.com/dapr/dapr/master/dapr/proto/common/v1/common.proto" "$PATH_ROOT/src/proto/dapr/proto/common/v1/common.proto"
# downloadFile "https://raw.githubusercontent.com/dapr/dapr/master/dapr/proto/runtime/v1/appcallback.proto" "$PATH_ROOT/src/proto/dapr/proto/runtime/v1/appcallback.proto"
# downloadFile "https://raw.githubusercontent.com/dapr/dapr/master/dapr/proto/runtime/v1/appcallback.proto" "$PATH_ROOT/src/proto/dapr/proto/runtime/v1/appcallback.proto"
# downloadFile "https://raw.githubusercontent.com/dapr/dapr/master/dapr/proto/runtime/v1/dapr.proto" "$PATH_ROOT/src/proto/dapr/proto/runtime/v1/dapr.proto"
# downloadFile "https://raw.githubusercontent.com/dapr/dapr/master/dapr/proto/sentry/v1/sentry.proto" "$PATH_ROOT/src/proto/dapr/proto/sentry/v1/sentry.proto"

# echo ""
# echo "Downloading latest Google Protobuf gRPC files"
# downloadFile "https://raw.githubusercontent.com/protocolbuffers/protobuf/master/src/google/protobuf/any.proto" "$PATH_ROOT/src/proto/google/protobuf/any.proto"
# downloadFile "https://raw.githubusercontent.com/protocolbuffers/protobuf/master/src/google/protobuf/empty.proto" "$PATH_ROOT/src/proto/google/protobuf/empty.proto"
# downloadFile "https://raw.githubusercontent.com/protocolbuffers/protobuf/master/src/google/protobuf/timestamp.proto" "$PATH_ROOT/src/proto/google/protobuf/timestamp.proto"

# echo ""
# echo "Compiling gRPC files"
# generateGrpc "$PATH_ROOT/src/proto" "dapr/proto/common/v1/common.proto"
# generateGrpc "$PATH_ROOT/src/proto" "dapr/proto/runtime/v1/dapr.proto"
# generateGrpc "$PATH_ROOT/src/proto" "dapr/proto/runtime/v1/appcallback.proto"
# generateGrpc "$PATH_ROOT/src/proto" "google/protobuf/any.proto"
# generateGrpc "$PATH_ROOT/src/proto" "google/protobuf/empty.proto"

# for file in $(find ./src/proto -name "*.proto"); do
#     rel="$(node -e 'console.log(require("path").relative(process.argv[1], process.argv[2]))' "${PATH_ROOT}/src/proto" "${file}")"
#     generateGrpc "${PATH_ROOT}/src/proto" "$rel"
# done

# find ./src/proto -name "*.proto" -print0 | xargs -0 pbjs -p src/proto -t static-module --es6 -w es6 -o src/grpc.js
# npx pbts -o src/grpc.d.ts src/grpc.js

PATH_PROTO=src/proto
TS_PROTO_OPTS="$(cat <<-EOF | grep -vE '^\s*#' | xargs echo | tr ' ' ','
	# addGrpcMetadata=true
	# addNestJsRestParameter=false
	# context=true
	esModuleInterop=true
	forceLong=long
	# fileSuffix=_pb
	# importSuffix=.js
	# initializeFieldsAsUndefined=false
	# lowerCaseServiceMethods=true
	# nestJs=true
	oneof=union
	# outputClientImpl=false
	# outputIndex=true
	# outputSchema=true
	# outputServices=default
	# outputServices=nice-grpc
	# outputServices=generic-definitions
	outputServices=grpc-js
	# outputTypeRegistry=true
	# returnObservable=false
	# rpcAfterResponse=true
	# rpcBeforeRequest=true
	# rpcErrorHandler=true
	stringEnums=true
	# unrecognizedEnum=false
	# useAbortSignal=true
	useAsyncIterable=true
	useExactTypes=true
	useOptionals=none
	# useReadonlyTypes=true
EOF
)"

echo "ts_proto_opts:"
echo "${TS_PROTO_OPTS}" | tr ',' '\n'
for file in $(find ./src/proto -name "*.proto" -print0 | xargs -0 ls) ; do
	"${PATH_ROOT}/node_modules/.bin/grpc_tools_node_protoc" \
		--plugin=ts_proto="${PATH_ROOT}/node_modules/.bin/protoc-gen-ts_proto" \
		--ts_proto_opt="${TS_PROTO_OPTS}" \
		--ts_proto_out="${PATH_ROOT}/src/proto" \
		-I="${PATH_PROTO}" \
		"${file}"
done

# echo ""
# echo "DONE"

#cleanup

generateGrpcSuccess
