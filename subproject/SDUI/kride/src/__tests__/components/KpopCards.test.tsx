import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

    fireEvent.click(screen.getByRole("button", { name: "View details" }));

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "ROUTE", actionUrl: "/kpop/artists?artistId=7" }),
      expect.objectContaining({ id: 7 }),
    );
  });

  it("follows and unfollows an artist through the authenticated endpoint", async () => {
    render(<ArtistCard data={{ id: 7, nameKo: "BTS" }} />);

    fireEvent.click(screen.getByRole("button", { name: "Follow" }));
    await screen.findByText("Following");
    fireEvent.click(screen.getByRole("button", { name: "Unfollow" }));
    await screen.findByText("Follow removed");

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

    fireEvent.click(screen.getByRole("button", { name: "Bookmark" }));

    await waitFor(() => expect(screen.getByText("Login required")).toBeInTheDocument());
  });
});
