import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { CommunitySubmissionForm } from "./components";
import { CommunityMediaSubmission } from "./submission-media";
import type { CommunityMapsClient } from "./client";
import type { CommunityMapCollection } from "@scalemule/sdk";
afterEach(cleanup);
const policy = {version:"test-policy",text:"Publication permission for this guide.",guidelines:"Only share material you may publish."};
const collection = {slug:"public-art", submission_policy:policy,areas:[{id:"area",name:"София"}],config:{submissions_open:true,categories:[{key:"art",label:"Art"}]}} as CommunityMapCollection;
function fill() {
  fireEvent.change(screen.getByLabelText("Name of place or display"),{target:{value:"Public mural"}});
  fireEvent.change(screen.getByLabelText("Description"),{target:{value:"A neighborhood mural"}});
  fireEvent.change(screen.getByLabelText("Location for editorial review"),{target:{value:"Private location"}});
}
describe("contributor permission and optional media",()=>{
  it("requires explicit permission, accepts a place without attachments, and preserves the policy version",async()=>{
    const submit=vi.fn().mockResolvedValue({id:"submission"});const upload=vi.fn();
    render(<CommunitySubmissionForm client={{submit,upload} as unknown as CommunityMapsClient} collection={collection}/>);
    fill(); const checkbox=screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);expect(checkbox.required).toBe(true);
    fireEvent.submit(screen.getByRole("button",{name:"Send to the editors"}).closest("form")!);
    await waitFor(()=>expect(screen.getByRole("alert")).toBeTruthy());expect(submit).not.toHaveBeenCalled();
    fireEvent.click(checkbox);
    fireEvent.submit(screen.getByRole("button",{name:"Send to the editors"}).closest("form")!);
    await waitFor(()=>expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][1].consent).toEqual({version:"test-policy",accepted:true});
    expect(upload).not.toHaveBeenCalled();
    await waitFor(()=>expect(screen.getByText("Thank you for contributing.")).toBeTruthy());
  });
  it("retains only failed attachments for retry after the place has been received",async()=>{
    const upload=vi.fn().mockResolvedValueOnce({id:"photo"}).mockRejectedValueOnce(new Error("Temporary failure")).mockResolvedValueOnce({id:"audio"});
    const files=[new File(["photo"],"photo.png",{type:"image/png"}),new File(["audio"],"voice.mp3",{type:"audio/mpeg"})];
    render(<CommunityMediaSubmission client={{upload} as unknown as CommunityMapsClient} slug="public-art" submission="existing" policy={policy} initialFiles={files} initialCaption="Caption retained"/>);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("button",{name:"Send attachments for review"}).closest("form")!);
    await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("Temporary failure"));
    expect(screen.queryByText("photo.png")).toBeNull();expect(screen.getByText("voice.mp3")).toBeTruthy();
    fireEvent.submit(screen.getByRole("button",{name:"Send attachments for review"}).closest("form")!);
    await waitFor(()=>expect(upload).toHaveBeenCalledTimes(3));
    expect(upload.mock.calls[2][2]).toBe(files[1]);
    expect(upload.mock.calls[2][3]).toMatchObject({consent_version:"test-policy",rights_confirmed:true,caption:"Caption retained"});
  });
});
