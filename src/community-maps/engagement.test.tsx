import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { CommunityVote, CommunityDiscussion } from "./engagement";
import type { CommunityMapsClient } from "./client";
import type { CommunityMapCollection, CommunityMapVote } from "@scalemule/sdk";
afterEach(cleanup);
const collection = {
  slug: "halloween-2026",
  config: { comments_enabled: true },
  submission_policy: {
    version: "test-consent",
    text: "Publication permission",
    guidelines: "Protect neighbors' privacy",
  },
} as CommunityMapCollection;
describe("community voting and discussions", () => {
  it("shows the saved vote, prevents duplicate clicks, supports a change and clear", async () => {
    let finish: (v: CommunityMapVote) => void = () => {};
    const vote = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<CommunityMapVote>((r) => {
            finish = r;
          }),
      )
      .mockResolvedValue({
        value: 0,
        up_count: 0,
        down_count: 0,
        score: 0,
        can_vote: true,
      });
    const client = {
      getVote: vi
        .fn()
        .mockResolvedValue({
          value: 1,
          up_count: 1,
          down_count: 0,
          score: 1,
          can_vote: true,
        }),
      vote,
    } as unknown as CommunityMapsClient;
    render(
      <CommunityVote client={client} slug="halloween-2026" featureId="place" />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Remove upvote" }),
      ).toBeTruthy(),
    );
    const down = screen.getByRole("button", { name: "Downvote" });
    fireEvent.click(down);
    fireEvent.click(down);
    expect(vote).toHaveBeenCalledTimes(1);
    expect(vote).toHaveBeenCalledWith("halloween-2026", "place", -1);
    finish({
      value: -1,
      up_count: 0,
      down_count: 1,
      score: -1,
      can_vote: true,
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Remove downvote" }),
      ).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove downvote" }));
    await waitFor(() =>
      expect(vote).toHaveBeenLastCalledWith("halloween-2026", "place", 0),
    );
  });
  it("offers sign in without casting votes for anonymous readers", async () => {
    const vote = vi.fn();
    const client = {
      getVote: vi
        .fn()
        .mockResolvedValue({
          value: 0,
          up_count: 2,
          down_count: 1,
          score: 1,
          can_vote: false,
        }),
      vote,
    } as unknown as CommunityMapsClient;
    render(
      <CommunityVote
        client={client}
        slug="halloween-2026"
        featureId="place"
        signInHref="/account?next=place"
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Sign in to vote" }),
      ).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Upvote" }));
    expect(vote).not.toHaveBeenCalled();
  });
  it("requires permission and keeps a newly submitted reply out of published comments", async () => {
    const comment = vi
      .fn()
      .mockResolvedValue({ id: "pending", status: "pending" });
    const client = {
      comments: vi
        .fn()
        .mockResolvedValue({
          items: [
            {
              id: "parent",
              body: "Published tip",
              author_name: "Neighbor",
              status: "approved",
              created_at: "2026-10-12T12:00:00Z",
            },
          ],
          next_page: null,
        }),
      comment,
    } as unknown as CommunityMapsClient;
    render(
      <CommunityDiscussion
        client={client}
        collection={collection}
        featureId="place"
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Reply" })).toBeTruthy(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    fireEvent.change(screen.getByLabelText("Public display name"), {
      target: { value: "Съсед 🌟" },
    });
    fireEvent.change(screen.getByLabelText("Your comment"), {
      target: { value: "Unpublished reply" },
    });
    const form = screen
      .getByRole("button", { name: "Submit for review" })
      .closest("form")!;
    fireEvent.submit(form);
    expect(comment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(form);
    await waitFor(() => expect(comment).toHaveBeenCalledTimes(1));
    expect(comment.mock.calls[0]).toEqual([
      "halloween-2026",
      {
        body: "Unpublished reply",
        author_name: "Съсед 🌟",
        parent_comment_id: "parent",
        consent: { accepted: true, version: "test-consent" },
      },
      "place",
    ]);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "after review and approval",
      ),
    );
    expect(screen.queryByText("Unpublished reply")).toBeNull();
  });
});
