"""Сервис для управления статусами актов."""

from core.state_machine import validate_transition
from contracts.models import Act


ACT_TRANSITIONS = {
    Act.Status.DRAFT: [Act.Status.AGREED, Act.Status.SIGNED, Act.Status.CANCELLED],
    Act.Status.AGREED: [Act.Status.SIGNED, Act.Status.CANCELLED],
    Act.Status.SIGNED: [],
    Act.Status.CANCELLED: [],
}


class ActService:

    @staticmethod
    def agree(act: Act) -> Act:
        validate_transition(act, Act.Status.AGREED, ACT_TRANSITIONS)
        act.status = Act.Status.AGREED
        act.save()
        return act

    @staticmethod
    def sign(act: Act) -> Act:
        validate_transition(act, Act.Status.SIGNED, ACT_TRANSITIONS)
        act.status = Act.Status.SIGNED
        act.save()
        return act
