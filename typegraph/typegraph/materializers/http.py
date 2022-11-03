# Copyright Metatype under the Elastic License 2.0.

from dataclasses import dataclass
from dataclasses import KW_ONLY
from typing import Optional

from typegraph.materializers.base import Materializer
from typegraph.materializers.base import Runtime
from typegraph.types import types as t


@dataclass(eq=True, frozen=True)
class HTTPRuntime(Runtime):
    endpoint: str
    cert_secret: Optional[str] = None
    basic_auth_secret: Optional[str] = None
    _: KW_ONLY
    runtime_name: str = "http"

    def data(self, collector):
        return {
            **super().data(collector),
            "cert_secret": self.cert_secret,
            "basic_auth_secret": self.basic_auth_secret,
        }

    def get(self, path: str, inp, out, **kwargs):
        return t.func(inp, out, RESTMat(self, "GET", path, **kwargs))

    def post(self, path: str, inp, out, **kwargs):
        return t.func(inp, out, RESTMat(self, "POST", path, **kwargs))

    def put(self, path: str, inp, out, **kwargs):
        return t.func(inp, out, RESTMat(self, "PUT", path, **kwargs))

    def patch(self, path: str, inp, out, **kwargs):
        return t.func(inp, out, RESTMat(self, "PATCH", path, **kwargs))

    def delete(self, path: str, inp, out, **kwargs):
        return t.func(inp, out, RESTMat(self, "DELETE", path, **kwargs))


@dataclass(eq=True, frozen=True)
class RESTMat(Materializer):
    runtime: Runtime
    verb: str
    path: str
    _: KW_ONLY
    content_type: str = "application/json"
    query_fields: Optional[tuple[str, ...]] = None
    body_fields: Optional[tuple[str, ...]] = None
    auth_token_field: Optional[str] = None
    materializer_name: str = "rest"
