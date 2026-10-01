from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

Color = Literal["white", "black"]


class NewGameRequest(BaseModel):
    bot_id: str
    player_color: Color = "white"
    base_minutes: float = Field(default=10, ge=0.1, le=180)
    increment_seconds: float = Field(default=0, ge=0, le=60)


class MoveRequest(BaseModel):
    uci: str | None = None
    from_square: str | None = Field(default=None, alias="from")
    to_square: str | None = Field(default=None, alias="to")
    promotion: str | None = None

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def _derive_uci(self) -> MoveRequest:
        if self.uci:
            return self
        if self.from_square and self.to_square:
            promo = self.promotion or ""
            self.uci = f"{self.from_square}{self.to_square}{promo}"
        if not self.uci:
            raise ValueError("Geef 'uci' of 'from' + 'to' op")
        return self


class ImportRequest(BaseModel):
    pgn: str
    bot_id: str = "mo"
    player_color: Color = "white"
