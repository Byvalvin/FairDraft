# Team Generation Algorithm

## Phase 0
Pure random split.

## Phase 1
Balance numeric rating:
- Sort descending
- Assign to lowest total team

## Phase 2+
Soft constraint scoring:
For each potential assignment:
  totalPenalty = sum(weight_i * imbalance_i)

Choose placement with lowest penalty.

Never hard fail.
Minimize imbalance.
