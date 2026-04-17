"""Agent tools — определение и исполнение инструментов LLM-агента."""

import logging

from django.db import connection

from apps.estimate.matching.knowledge import ProductKnowledge
from apps.estimate.models import EstimateItem

logger = logging.getLogger(__name__)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_items",
            "description": "Получить все позиции сметы",
            "parameters": {
                "type": "object",
                "properties": {"estimate_id": {"type": "string"}},
                "required": ["estimate_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_item_detail",
            "description": "Подробности одной позиции (цены, наценки, ТТХ)",
            "parameters": {
                "type": "object",
                "properties": {"item_id": {"type": "string"}},
                "required": ["item_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_alternatives",
            "description": "Найти аналоги по названию через ProductKnowledge",
            "parameters": {
                "type": "object",
                "properties": {
                    "item_name": {"type": "string"},
                    "unit": {"type": "string"},
                },
                "required": ["item_name"],
            },
        },
    },
]


def execute_tool(tool_name: str, arguments: dict, workspace_id: str, estimate_id: str) -> dict:
    """Выполнить tool call. Возвращает результат для messages."""
    handlers = {
        "get_items": _handle_get_items,
        "get_item_detail": _handle_get_item_detail,
        "find_alternatives": _handle_find_alternatives,
    }
    handler = handlers.get(tool_name)
    if not handler:
        logger.warning("Unknown tool: %s", tool_name)
        return {"error": f"Unknown tool: {tool_name}"}
    return handler(arguments, workspace_id, estimate_id)


def _handle_get_items(args: dict, workspace_id: str, estimate_id: str) -> dict:
    eid = args.get("estimate_id", estimate_id)
    items = EstimateItem.objects.filter(estimate_id=eid, workspace_id=workspace_id)
    return {
        "items": [
            {
                "id": str(i.id),
                "name": i.name,
                "unit": i.unit,
                "quantity": str(i.quantity),
                "equipment_price": str(i.equipment_price),
                "material_price": str(i.material_price),
                "work_price": str(i.work_price),
                "total": str(i.total),
                "match_source": i.match_source,
            }
            for i in items
        ],
        "count": items.count(),
    }


def _handle_get_item_detail(args: dict, workspace_id: str, estimate_id: str) -> dict:
    item_id = args["item_id"]
    try:
        item = EstimateItem.all_objects.get(id=item_id, workspace_id=workspace_id)
    except EstimateItem.DoesNotExist:
        return {"error": f"Item {item_id} not found"}
    return {
        "id": str(item.id),
        "name": item.name,
        "unit": item.unit,
        "quantity": str(item.quantity),
        "equipment_price": str(item.equipment_price),
        "material_price": str(item.material_price),
        "work_price": str(item.work_price),
        "total": str(item.total),
        "match_source": item.match_source,
        "is_key_equipment": item.is_key_equipment,
        "tech_specs": item.tech_specs,
    }


def _handle_find_alternatives(args: dict, workspace_id: str, estimate_id: str) -> dict:
    name = args.get("item_name", "").lower()
    rules = ProductKnowledge.objects.filter(workspace_id=workspace_id, is_active=True)
    matches = []
    for rule in rules:
        if rule.matches(name):
            matches.append({
                "work_name": rule.work_name,
                "work_unit": rule.work_unit,
                "work_price": str(rule.work_price),
                "confidence": str(rule.confidence),
            })
    return {"alternatives": matches, "count": len(matches)}
