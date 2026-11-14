export type ListMode = "blocklist" | "allowlist";
export type BlockReason = "blocked" | "not-allowed";

export type SiteLists = {
  blocklistSites: string[];
  allowlistSites: string[];
};

export type BlockingSettings = SiteLists & {
  listMode: ListMode;
};
