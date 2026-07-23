import { act, renderHook } from "@testing-library/react";
import { buildRegisterPayload, useBusinessActions } from "@kride/core";
import type { PostcodeResult } from "@kride/core";

// Mirrors the V22/V79 seed rows for REGISTER_PAGE / VERIFY_CODE_PAGE buttons.
const ID_CHECK_BTN = {
  component_id: "reg_id_check",
  component_type: "BUTTON",
  action_type: "CHECK_USER_ID",
  action_url: "/api/auth/check-user-id",
};
const ADDR_BTN = {
  component_id: "reg_addr_btn",
  component_type: "BUTTON",
  action_type: "OPEN_POSTCODE",
};
const SUBMIT_BTN = {
  component_id: "reg_submit",
  component_type: "BUTTON",
  action_type: "REGISTER_SUBMIT",
  action_url: "/api/auth/register",
};
const VERIFY_BTN = {
  component_id: "verify_submit",
  component_type: "BUTTON",
  action_type: "VERIFY_CODE",
  action_url: "/api/auth/verify-code",
};

const METADATA = [ID_CHECK_BTN, ADDR_BTN, SUBMIT_BTN];
const EMPTY_OBJ = {};
const RUNTIME = { apiBase: "https://api.test" };

type Navigation = {
  push: jest.Mock;
  notify: jest.Mock;
  openPostcode: jest.Mock;
};

const setup = (navigationOverrides: Partial<Navigation> = {}) => {
  const navigation: Navigation = {
    push: jest.fn(),
    notify: jest.fn(),
    openPostcode: jest.fn(),
    ...navigationOverrides,
  };
  const hook = renderHook(() =>
    useBusinessActions("REGISTER_PAGE", METADATA, EMPTY_OBJ, navigation, EMPTY_OBJ, RUNTIME)
  );
  return { navigation, hook };
};

const fillRegisterForm = async (hook: ReturnType<typeof setup>["hook"]) => {
  await act(async () => {
    hook.result.current.handleChange("userId", "kride_fan");
    hook.result.current.handleChange("email", "fan@naver.com");
    hook.result.current.handleChange("password", "pw123456");
    hook.result.current.handleChange("phone", "01012345678");
    hook.result.current.handleChange("zipCode", "06236");
    hook.result.current.handleChange("roadAddress", "서울 강남구 테헤란로 152");
    hook.result.current.handleChange("detailAddress", "3층");
  });
};

const passIdCheck = async (hook: ReturnType<typeof setup>["hook"]) => {
  await act(async () => {
    hook.result.current.setFormData((prev: any) => ({
      ...prev,
      _userIdChecked: true,
      _checkedUserId: "kride_fan",
    }));
  });
};

describe("buildRegisterPayload", () => {
  it("drops bookkeeping keys and strips the reg_ prefix", () => {
    expect(
      buildRegisterPayload({
        userId: "abc_1234",
        reg_email: "a@b.com",
        _userIdChecked: true,
        _checkedUserId: "abc_1234",
      })
    ).toEqual({ userId: "abc_1234", email: "a@b.com" });
  });
});

describe("CHECK_USER_ID", () => {
  beforeEach(() => jest.restoreAllMocks());

  it("marks the id as checked when the server says it is available", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ available: true, message: "사용 가능한 아이디입니다." }),
    });
    global.fetch = fetchMock as any;

    const { navigation, hook } = setup();
    await act(async () => {
      hook.result.current.handleChange("userId", "kride_fan");
    });
    await act(async () => {
      await hook.result.current.handleAction(ID_CHECK_BTN);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/api/auth/check-user-id?userId=kride_fan"
    );
    expect(hook.result.current.formData._userIdChecked).toBe(true);
    expect(hook.result.current.formData._checkedUserId).toBe("kride_fan");
    expect(navigation.notify).toHaveBeenCalledWith("사용 가능한 아이디입니다.");
  });

  it("rejects malformed ids locally without calling the API", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    const { navigation, hook } = setup();
    await act(async () => {
      hook.result.current.handleChange("userId", "한글아이디");
    });
    await act(async () => {
      await hook.result.current.handleAction(ID_CHECK_BTN);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(navigation.notify).toHaveBeenCalledWith(
      "아이디는 영문, 숫자, 밑줄을 사용해 4~20자로 입력해주세요."
    );
  });

  it("clears the checked flag when the id is taken", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ available: false, message: "이미 사용 중인 아이디입니다." }),
    }) as any;

    const { navigation, hook } = setup();
    await act(async () => {
      hook.result.current.handleChange("userId", "kride_fan");
    });
    await act(async () => {
      await hook.result.current.handleAction(ID_CHECK_BTN);
    });

    expect(hook.result.current.formData._userIdChecked).toBe(false);
    expect(navigation.notify).toHaveBeenCalledWith("이미 사용 중인 아이디입니다.");
  });
});

describe("OPEN_POSTCODE", () => {
  it("routes through navigation.openPostcode and applies the picked address", async () => {
    const openPostcode = jest.fn((onComplete: (result: PostcodeResult) => void) =>
      onComplete({ zipCode: "06236", roadAddress: "서울 강남구 테헤란로 152" })
    );
    const { hook } = setup({ openPostcode });

    await act(async () => {
      await hook.result.current.handleAction(ADDR_BTN);
    });

    expect(openPostcode).toHaveBeenCalledTimes(1);
    expect(hook.result.current.formData.zipCode).toBe("06236");
    expect(hook.result.current.formData.roadAddress).toBe("서울 강남구 테헤란로 152");
  });
});

describe("REGISTER_SUBMIT", () => {
  beforeEach(() => jest.restoreAllMocks());

  it("blocks submission until the id duplication check has passed", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    const { navigation, hook } = setup();
    await fillRegisterForm(hook);
    await act(async () => {
      await hook.result.current.handleAction(SUBMIT_BTN);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(navigation.notify).toHaveBeenCalledWith("아이디 중복 확인을 완료해주세요.");
  });

  it("requires an address from the postcode search", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    const { navigation, hook } = setup();
    await fillRegisterForm(hook);
    await passIdCheck(hook);
    await act(async () => {
      hook.result.current.handleChange("zipCode", "");
    });
    await act(async () => {
      await hook.result.current.handleAction(SUBMIT_BTN);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(navigation.notify).toHaveBeenCalledWith(
      "주소 찾기로 우편번호와 도로명 주소를 입력해주세요."
    );
  });

  it("registers, fires the welcome mail, and moves to the verify page", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 201, text: async () => "User registred successfully!" })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    global.fetch = fetchMock as any;

    const { navigation, hook } = setup();
    await fillRegisterForm(hook);
    await passIdCheck(hook);
    await act(async () => {
      await hook.result.current.handleAction(SUBMIT_BTN);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [registerUrl, registerInit] = fetchMock.mock.calls[0];
    expect(registerUrl).toBe("https://api.test/api/auth/register");
    const payload = JSON.parse(registerInit.body);
    expect(payload).toMatchObject({
      userId: "kride_fan",
      email: "fan@naver.com",
      password: "pw123456",
      phone: "010-1234-5678", // digits-only input must be normalized
      zipCode: "06236",
      roadAddress: "서울 강남구 테헤란로 152",
      detailAddress: "3층",
    });
    expect(payload._userIdChecked).toBeUndefined();

    const [mailUrl, mailInit] = fetchMock.mock.calls[1];
    expect(mailUrl).toBe("https://api.test/api/auth/signup?message=welcome");
    expect(JSON.parse(mailInit.body)).toEqual({ email: "fan@naver.com" });

    expect(navigation.notify).toHaveBeenCalledWith(
      "가입 성공! 이메일로 발송된 인증코드를 확인해주세요."
    );
    expect(navigation.push).toHaveBeenCalledWith(
      `/VERIFY_CODE_PAGE?email=${encodeURIComponent("fan@naver.com")}`
    );
  });

  it("surfaces the server's error body when registration fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 409,
      text: async () => "이미 존재하는 사용자입니다.",
    }) as any;

    const { navigation, hook } = setup();
    await fillRegisterForm(hook);
    await passIdCheck(hook);
    await act(async () => {
      await hook.result.current.handleAction(SUBMIT_BTN);
    });

    expect(navigation.notify).toHaveBeenCalledWith("이미 존재하는 사용자입니다.");
    expect(navigation.push).not.toHaveBeenCalled();
  });
});

describe("VERIFY_CODE", () => {
  beforeEach(() => jest.restoreAllMocks());

  it("verifies with the email/code from formData and returns to login", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "인증 성공!",
    });
    global.fetch = fetchMock as any;

    const { navigation, hook } = setup();
    await act(async () => {
      hook.result.current.handleChange("email", "fan@naver.com");
      hook.result.current.handleChange("code", "123456");
    });
    await act(async () => {
      await hook.result.current.handleAction(VERIFY_BTN);
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/api/auth/verify-code");
    expect(JSON.parse(init.body)).toEqual({ email: "fan@naver.com", code: "123456" });
    expect(navigation.push).toHaveBeenCalledWith("/LOGIN_PAGE");
  });

  it("asks for the code when it is missing", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    const { navigation, hook } = setup();
    await act(async () => {
      hook.result.current.handleChange("email", "fan@naver.com");
    });
    await act(async () => {
      await hook.result.current.handleAction(VERIFY_BTN);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(navigation.notify).toHaveBeenCalledWith("인증 번호를 입력해주세요.");
  });
});
