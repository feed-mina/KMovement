// React 18.2 does not export `act` from the `react` package (added in 18.3+).
// Import from `react-dom/test-utils` for store-level state mutations.
import { act } from "react-dom/test-utils";
import { useOnboardingStore } from "@/store/onboarding-store";
import type { ContentItem, TravelDuration } from "@/store/onboarding-store";

// zustand는 모듈 스코프 상태이므로 각 테스트 전 reset
beforeEach(() => {
  act(() => {
    useOnboardingStore.getState().reset();
  });
});

// ─────────────────────────────────────────────
// Intro1: 여행 기간 설정
// ─────────────────────────────────────────────
describe("Intro1 - 여행 기간 선택", () => {
  it("초기값은 null이다", () => {
    expect(useOnboardingStore.getState().duration).toBeNull();
  });

  it.each<TravelDuration>(["day", "onenight", "twonight"])(
    "setDuration('%s')을 호출하면 duration이 업데이트된다",
    (value) => {
      act(() => {
        useOnboardingStore.getState().setDuration(value);
      });
      expect(useOnboardingStore.getState().duration).toBe(value);
    }
  );
});

// ─────────────────────────────────────────────
// Intro2: 아티스트 선택 (최대 5개)
// ─────────────────────────────────────────────
describe("Intro2 - 아티스트 선택", () => {
  const makeArtist = (id: number): ContentItem => ({
    id,
    name: `Artist${id}`,
    imageUrl: "",
  });

  it("아티스트를 토글하면 selectedArtists에 추가된다", () => {
    act(() => {
      useOnboardingStore.getState().toggleArtist(makeArtist(1));
    });
    expect(useOnboardingStore.getState().selectedArtists).toHaveLength(1);
  });

  it("같은 아티스트를 다시 토글하면 제거된다", () => {
    act(() => {
      useOnboardingStore.getState().toggleArtist(makeArtist(1));
      useOnboardingStore.getState().toggleArtist(makeArtist(1));
    });
    expect(useOnboardingStore.getState().selectedArtists).toHaveLength(0);
  });

  it("5명까지 선택 가능하다", () => {
    act(() => {
      for (let i = 1; i <= 5; i++) {
        useOnboardingStore.getState().toggleArtist(makeArtist(i));
      }
    });
    expect(useOnboardingStore.getState().selectedArtists).toHaveLength(5);
  });

  it("5명 초과 시 추가되지 않는다", () => {
    act(() => {
      for (let i = 1; i <= 6; i++) {
        useOnboardingStore.getState().toggleArtist(makeArtist(i));
      }
    });
    expect(useOnboardingStore.getState().selectedArtists).toHaveLength(5);
  });
});

// ─────────────────────────────────────────────
// Intro3: 지역 선택 (최대 5개, Intro2와 동일 로직)
// ─────────────────────────────────────────────
describe("Intro3 - 지역 선택", () => {
  const makeRegion = (id: number): ContentItem => ({
    id,
    name: `Region${id}`,
    imageUrl: "",
  });

  it("5곳까지 선택 가능하다", () => {
    act(() => {
      for (let i = 1; i <= 5; i++) {
        useOnboardingStore.getState().toggleRegion(makeRegion(i));
      }
    });
    expect(useOnboardingStore.getState().selectedRegions).toHaveLength(5);
  });

  it("5곳 초과 시 추가되지 않는다", () => {
    act(() => {
      for (let i = 1; i <= 6; i++) {
        useOnboardingStore.getState().toggleRegion(makeRegion(i));
      }
    });
    expect(useOnboardingStore.getState().selectedRegions).toHaveLength(5);
  });

  it("같은 지역 재선택 시 제거된다", () => {
    act(() => {
      useOnboardingStore.getState().toggleRegion(makeRegion(1));
      useOnboardingStore.getState().toggleRegion(makeRegion(1));
    });
    expect(useOnboardingStore.getState().selectedRegions).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// Intro4: 여행 목적 다중 선택 + 토글 해제
// ─────────────────────────────────────────────
describe("Intro4 - 여행 목적 선택", () => {
  it("목적을 선택하면 purposes에 추가된다", () => {
    act(() => {
      useOnboardingStore.getState().togglePurpose("food");
    });
    expect(useOnboardingStore.getState().purposes).toContain("food");
  });

  it("다중 선택이 가능하다", () => {
    act(() => {
      useOnboardingStore.getState().togglePurpose("food");
      useOnboardingStore.getState().togglePurpose("nature");
      useOnboardingStore.getState().togglePurpose("history");
    });
    expect(useOnboardingStore.getState().purposes).toHaveLength(3);
  });

  it("이미 선택된 목적을 다시 토글하면 제거된다", () => {
    act(() => {
      useOnboardingStore.getState().togglePurpose("food");
      useOnboardingStore.getState().togglePurpose("food");
    });
    expect(useOnboardingStore.getState().purposes).not.toContain("food");
  });

  it("6개 목적 모두 선택 가능하다", () => {
    act(() => {
      (["food", "kculture", "nature", "history", "shopping", "rest"] as const).forEach(
        (p) => useOnboardingStore.getState().togglePurpose(p)
      );
    });
    expect(useOnboardingStore.getState().purposes).toHaveLength(6);
  });
});

// ─────────────────────────────────────────────
// Intro5: 예산 범위
// ─────────────────────────────────────────────
describe("Intro5 - 예산 슬라이더", () => {
  it("초기 예산은 30000 ~ 2000000이다", () => {
    const { budget } = useOnboardingStore.getState();
    expect(budget.min).toBe(30000);
    expect(budget.max).toBe(2000000);
  });

  it("setBudget으로 예산을 변경할 수 있다", () => {
    act(() => {
      useOnboardingStore.getState().setBudget({ min: 100000, max: 500000 });
    });
    const { budget } = useOnboardingStore.getState();
    expect(budget.min).toBe(100000);
    expect(budget.max).toBe(500000);
  });

  it("경계값: min = 30000 설정 가능", () => {
    act(() => {
      useOnboardingStore.getState().setBudget({ min: 30000, max: 30000 });
    });
    expect(useOnboardingStore.getState().budget.min).toBe(30000);
  });

  it("경계값: max = 2000000 설정 가능", () => {
    act(() => {
      useOnboardingStore.getState().setBudget({ min: 2000000, max: 2000000 });
    });
    expect(useOnboardingStore.getState().budget.max).toBe(2000000);
  });
});

// ─────────────────────────────────────────────
// My-list: duration null 체크 (redirect 로직)
// ─────────────────────────────────────────────
describe("My-list - duration 완료 여부", () => {
  it("duration이 null이면 온보딩 미완료 상태이다", () => {
    expect(useOnboardingStore.getState().duration).toBeNull();
  });

  it("duration이 설정되면 온보딩 완료 상태이다", () => {
    act(() => {
      useOnboardingStore.getState().setDuration("day");
    });
    expect(useOnboardingStore.getState().duration).not.toBeNull();
  });
});

// ─────────────────────────────────────────────
// reset
// ─────────────────────────────────────────────
describe("reset", () => {
  it("reset을 호출하면 모든 상태가 초기화된다", () => {
    act(() => {
      useOnboardingStore.getState().setDuration("twonight");
      useOnboardingStore.getState().togglePurpose("food");
      useOnboardingStore.getState().setBudget({ min: 100000, max: 500000 });
      useOnboardingStore.getState().reset();
    });
    const state = useOnboardingStore.getState();
    expect(state.duration).toBeNull();
    expect(state.purposes).toHaveLength(0);
    expect(state.budget.min).toBe(30000);
    expect(state.budget.max).toBe(2000000);
  });
});
