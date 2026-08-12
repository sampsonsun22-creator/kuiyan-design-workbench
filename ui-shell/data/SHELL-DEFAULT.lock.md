# SHELL DEFAULT LOCK

shell_default: **strict**
qc_mode: **brief_relevance_v1**
main_wall: **452**
pending_review: **2680**

Restore source: **current ui-shell/data mirror @452 ONLY**.
Do NOT restore from any 410 backup / dated stale mirror.

Unlock gate: next expanded main_wall must be **>452**.

FORBIDDEN:
- rollback to 410 / 401 / 304 / 274
- image_gate (~1820)
- wide / structural / *.BAD_*

Unlock: ask 奎燕平台资源专家.
