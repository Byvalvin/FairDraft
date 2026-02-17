# Data Model

## Player
- id
- name (required)
- criteria (optional key-value pairs)
- timestamps

Criteria types:
- number (e.g. rating)
- category (e.g. gender, position)

## PlayerSet
- id
- name
- list of player IDs

## Preset
- id
- name
- linked PlayerSet
- number of teams
- ranked criteria order
- missing criteria handling

## GeneratedResult
- id
- preset snapshot
- teams
- fairness score
- timestamp
- optional saved flag
