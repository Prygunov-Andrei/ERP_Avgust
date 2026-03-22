"""Сервис для управления статусами рамочных договоров."""

from core.state_machine import validate_transition
from contracts.models import FrameworkContract


FRAMEWORK_TRANSITIONS = {
    FrameworkContract.Status.DRAFT: [
        FrameworkContract.Status.ACTIVE,
        FrameworkContract.Status.TERMINATED,
    ],
    FrameworkContract.Status.ACTIVE: [
        FrameworkContract.Status.EXPIRED,
        FrameworkContract.Status.TERMINATED,
    ],
    FrameworkContract.Status.EXPIRED: [FrameworkContract.Status.TERMINATED],
    FrameworkContract.Status.TERMINATED: [],
}


class FrameworkContractService:

    @staticmethod
    def activate(framework: FrameworkContract) -> FrameworkContract:
        validate_transition(
            framework, FrameworkContract.Status.ACTIVE, FRAMEWORK_TRANSITIONS
        )
        framework.status = FrameworkContract.Status.ACTIVE
        framework.save()
        return framework

    @staticmethod
    def terminate(framework: FrameworkContract) -> FrameworkContract:
        validate_transition(
            framework, FrameworkContract.Status.TERMINATED, FRAMEWORK_TRANSITIONS
        )
        framework.status = FrameworkContract.Status.TERMINATED
        framework.save()
        return framework
