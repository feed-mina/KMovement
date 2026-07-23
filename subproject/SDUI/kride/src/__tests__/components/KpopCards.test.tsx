import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArtistCard, EventCard } from "@/components/kride/KpopCards";

describe("K-POP cards", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "success" }),
    }) as jest.Mock;
  });

  it("routes an artist card to the selected artist detail", () => {
    const onAction = jest.fn();
    render(<ArtistCard data={{ id: 7, nameKo: "BTS" }} meta={{ actionType: "ROUTE" }} onAction={onAction} />);

    fireEvent.click(screen.getByRole("button", { name: "BTS 상세 보기" }));

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "ROUTE", actionUrl: "/kpop/artists?artistId=7" }),
      expect.objectContaining({ id: 7 }),
    );
  });

  it("follows and unfollows an artist through the authenticated endpoint", async () => {
    render(<ArtistCard data={{ id: 7, nameKo: "BTS" }} />);

    const followButton = screen.getByRole("button", { name: "팔로우" });
    expect(followButton).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(followButton);
    await screen.findByText("팔로우했습니다.");
    expect(screen.getByRole("button", { name: "팔로우 취소" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "팔로우 취소" }));
    await screen.findByText("팔로우를 취소했습니다.");

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      "/api/v1/kpop/artists/7/follow",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/v1/kpop/artists/7/follow",
      expect.objectContaining({ method: "DELETE", credentials: "include" }),
    );
  });

  it("reports a login requirement when event bookmarking is unauthorized", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 401 });
    render(<EventCard data={{ id: 9, titleKo: "Seoul fan route" }} />);

    fireEvent.click(screen.getByRole("button", { name: "일정 저장" }));

    await waitFor(() => expect(screen.getByText("로그인 후 일정을 저장할 수 있습니다.")).toBeInTheDocument());
  });

  it("provides descriptive image alternatives and a non-color reliability note", () => {
    const { rerender } = render(<ArtistCard data={{ id: 7, nameKo: "BTS", imageUrl: "https://img.example/bts.jpg" }} />);
    expect(screen.getByRole("img", { name: "BTS 아티스트 프로필 이미지" })).toBeInTheDocument();

    rerender(<EventCard data={{ id: 9, titleKo: "서울 팬 이벤트", venue: "잠실" }} />);
    expect(screen.getByRole("note")).toHaveTextContent("출처 안내:");
    expect(screen.getByText(/공식 또는 운영 검수 완료 링크/)).toBeInTheDocument();
  });

  it("activates card actions with keyboard Enter and Space", async () => {
    const user = userEvent.setup();
    const onAction = jest.fn();
    render(<ArtistCard data={{ id: 7, nameKo: "BTS" }} onAction={onAction} />);

    await user.tab();
    expect(screen.getByRole("button", { name: "BTS 상세 보기" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledTimes(1);

    await user.tab();
    expect(screen.getByRole("button", { name: "팔로우" })).toHaveFocus();
    await user.keyboard(" ");
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/kpop/artists/7/follow",
      expect.objectContaining({ method: "POST" }),
    ));
  });
});
