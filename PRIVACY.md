# Block AI Overview — Privacy Policy

**Last updated:** April 2026

## Overview

Block AI Overview is a browser extension that appends the `udm=14` query parameter to Google Search URLs to disable AI Overview results. 

## Data Collection

**NoAI Search does not collect, store, transmit, or share any user data.** Specifically:

- No personal information is collected
- No browsing history is recorded or transmitted
- No analytics or tracking of any kind
- No cookies are set by this extension
- No network requests are made by this extension

## Data Storage

The only data stored is your toggle preference (on/off), saved locally in Chrome's `chrome.storage.sync` API. This syncs across your Chrome browsers via your Google account, just like any other Chrome setting. No data is sent to any external server.

## Permissions

- **`storage`** — Saves your on/off toggle preference
- **`declarativeNetRequest`** — Modifies Google Search URLs to append `udm=14` before the request is sent
- **Host permissions for `google.*` domains** — Required to modify Google Search URLs only

## Third Parties

This extension does not communicate with any third-party services or servers.

## Changes

If this policy is updated, the new version will be published with the extension update.

## Contact

If you have questions about this privacy policy, please open an issue on the extension's GitHub repository.
