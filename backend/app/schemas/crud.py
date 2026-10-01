from typing import Any

from pydantic import BaseModel, Field


class CrudCreateRequest(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class CrudUpdateRequest(BaseModel):
    key: dict[str, Any] = Field(default_factory=dict)
    data: dict[str, Any] = Field(default_factory=dict)


class CrudDeleteRequest(BaseModel):
    key: dict[str, Any] = Field(default_factory=dict)


class CrudLookupRequest(BaseModel):
    key: dict[str, Any] = Field(default_factory=dict)
