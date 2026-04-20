# UI Backlog — замечания для исправления

## Высокий приоритет

### 1. Resizable sections panel
- Sidebar разделов (w-64 = 256px) — слишком узкий для длинных названий
- Нужно: drag-handle на правой границе, resize мышкой
- Состояние ширины сохранять в localStorage
- Библиотека: react-resizable-panels или кастомный resize через onMouseDown/Move/Up

## Средний приоритет

### 2. Разделение name / model / manufacturer
- Сейчас: всё в одном поле `name` = "Вентилятор канальный WNK 100/1 Корф"
- Нужно: `name` = "Вентилятор канальный", `tech_specs.model` = "WNK 100/1", `tech_specs.manufacturer` = "Корф"
- Модель данных готова (tech_specs JSONB с Pydantic TechSpecs: model, manufacturer)
- SpecificationParser уже возвращает name/model/brand раздельно
- Что доделать:
  - PDF import: писать model/brand в tech_specs (сейчас конкатенирует в name)
  - Excel import: маппинг столбца "Модель"/"Марка"/"Артикул" → tech_specs.model
  - Matching grouping: нормализация убирает модель из name перед сравнением
  - UI: отображение model отдельно (tooltip или доп. столбец)
- Не требует миграции — tech_specs уже существует

## Записано
- 2026-04-20: resizable sections panel (Андрей)
- 2026-04-20: разделение name/model/manufacturer (Андрей)
