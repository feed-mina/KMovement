"""테스트가 심어 놓은 가짜 모듈이 다음 테스트로 새지 않게 한다.

여러 테스트가 무거운 의존성(chromadb, groq, sklearn …)을 `sys.modules` 에 가짜
모듈로 심은 뒤 대상 모듈을 import 한다. 그런데 그 항목을 그대로 두면 **같은
프로세스에서 나중에 수집되는 테스트가 진짜 모듈 대신 가짜를 집는다.**

실제로 `test_community_chatbot_integration.py` 가 `src.ml.feature_engineering`
을 가짜로 심어 두어, 뒤에 오는 `test_ensemble.py` 가 수집 단계에서 죽었다.

```
ImportError: cannot import name 'haversine' from 'src.ml.feature_engineering'
             (unknown location)
```

"unknown location" 이 단서였다 — 파일에서 온 모듈이 아니라 메모리에 만들어진
모듈이라는 뜻이다. 파일 하나만 돌리면 통과하고 전체를 돌리면 죽으므로 원인이
자기 파일 안에 없어 찾기 어렵다.

`stub_modules()` 는 블록을 빠져나올 때 `sys.modules` 를 들어올 때 상태로
되돌린다. 대상 모듈은 블록 안에서 import 하면 되고, 이미 참조를 들고 있으므로
되돌린 뒤에도 그대로 동작한다.
"""
from __future__ import annotations

import sys
import types
from contextlib import contextmanager
from typing import Iterable, Iterator, Mapping


@contextmanager
def stub_modules(
    names: Iterable[str] = (),
    replacements: Mapping[str, types.ModuleType] | None = None,
) -> Iterator[None]:
    """블록 안에서만 가짜 모듈을 심는다.

    `names` 는 빈 모듈로 채우되 **이미 있으면 건드리지 않는다**(진짜 모듈이
    있으면 그것을 쓴다). `replacements` 는 넘긴 모듈로 무조건 덮어쓴다.
    """
    touched: dict[str, types.ModuleType | None] = {}

    for name in names:
        if name not in sys.modules:
            touched[name] = None
            module = types.ModuleType(name)
            module.__dict__.setdefault("__all__", [])
            sys.modules[name] = module

    for name, module in (replacements or {}).items():
        touched.setdefault(name, sys.modules.get(name))
        sys.modules[name] = module

    try:
        yield
    finally:
        for name, previous in touched.items():
            if previous is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = previous
