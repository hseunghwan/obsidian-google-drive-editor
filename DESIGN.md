---
version: alpha
name: Obsidian Drive Editor
description: "A quiet, dense, Obsidian-inspired dark workspace for editing Markdown files stored in Google Drive."
colors:
  app-bg: "#1E1E1E"
  editor-bg: "#1E1E1E"
  titlebar-bg: "#303030"
  panel-bg: "#252525"
  panel-bg-raised: "#2D2D2D"
  panel-bg-hover: "#333333"
  panel-bg-active: "#3A3A3A"
  settings-card-bg: "#242424"
  settings-sidebar-bg: "#1F1F1F"
  divider: "#343434"
  divider-subtle: "#2B2B2B"
  control-bg: "#303136"
  control-border: "#454545"
  text-primary: "#EDEEF2"
  text-secondary: "#C7C7C7"
  text-muted: "#9A9A9A"
  text-faint: "#737373"
  accent: "#8AADF4"
  accent-muted: "#5D6F91"
  settings-accent: "#8B5CF6"
  settings-accent-hover: "#9B72FF"
  selection-bg: "#3C4F73"
  switch-track-off: "#4A4A4A"
  scrollbar-thumb: "#686868"
  success-bg: "#1F312B"
  success-border: "#3D4F48"
  success-text: "#BAF0DC"
  error: "#FF6B6B"
  light-app-bg: "#F6F5F2"
  light-panel-bg: "#EBE8E1"
  light-text-primary: "#26282F"
  light-text-muted: "#6D6F77"
typography:
  title-lg:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: 0
  title-md:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: 0
  body-md:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: 0
  body-sm:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  label-sm:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: 0
  mono-sm:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
spacing:
  none: 0px
  xxs: 2px
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  xxl: 24px
  editor-inline: 32px
  editor-top: 36px
  sidebar-width: 260px
  metadata-width: 280px
  activity-rail-width: 40px
  settings-dialog-max-width: 1100px
  settings-sidebar-width: 250px
  settings-content-max-width: 736px
  settings-card-padding: 20px
  settings-row-min-height: 58px
rounded:
  none: 0px
  xs: 3px
  sm: 4px
  md: 6px
  lg: 8px
  full: 9999px
components:
  workspace:
    backgroundColor: "{colors.app-bg}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-md}"
  titlebar:
    backgroundColor: "{colors.titlebar-bg}"
    textColor: "{colors.text-secondary}"
    height: 38px
    borderColor: "{colors.divider}"
  sidebar:
    backgroundColor: "{colors.panel-bg}"
    textColor: "{colors.text-secondary}"
    width: "{spacing.sidebar-width}"
    borderColor: "{colors.divider}"
  sidebar-item:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: "6px 8px"
  sidebar-item-hover:
    backgroundColor: "{colors.panel-bg-hover}"
    textColor: "{colors.text-primary}"
  sidebar-item-active:
    backgroundColor: "{colors.panel-bg-active}"
    textColor: "{colors.text-primary}"
  editor-pane:
    backgroundColor: "{colors.editor-bg}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body-md}"
  metadata-panel:
    backgroundColor: "{colors.panel-bg}"
    textColor: "{colors.text-secondary}"
    width: "{spacing.metadata-width}"
    borderColor: "{colors.divider}"
  button-secondary:
    backgroundColor: "{colors.control-bg}"
    textColor: "{colors.text-secondary}"
    borderColor: "{colors.control-border}"
    rounded: "{rounded.sm}"
    padding: "7px 8px"
  input:
    backgroundColor: "{colors.app-bg}"
    textColor: "{colors.text-primary}"
    borderColor: "{colors.divider}"
    rounded: "{rounded.sm}"
    padding: "7px 8px"
  icon:
    iconSet: "Lucide"
    size: 16px
    strokeWidth: 1.75
    textColor: "{colors.text-muted}"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.sm}"
    size: 28px
  icon-button-hover:
    backgroundColor: "{colors.panel-bg-hover}"
    textColor: "{colors.text-primary}"
  settings-dialog:
    backgroundColor: "{colors.app-bg}"
    textColor: "{colors.text-primary}"
    width: "{spacing.settings-dialog-max-width}"
    rounded: "{rounded.lg}"
    borderColor: "{colors.control-border}"
  settings-sidebar:
    backgroundColor: "{colors.settings-sidebar-bg}"
    textColor: "{colors.text-secondary}"
    width: "{spacing.settings-sidebar-width}"
    borderColor: "{colors.divider}"
  settings-sidebar-item:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: "6px 8px"
  settings-sidebar-item-active:
    backgroundColor: "{colors.panel-bg-active}"
    textColor: "{colors.text-primary}"
  settings-card:
    backgroundColor: "{colors.settings-card-bg}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.lg}"
    padding: "{spacing.settings-card-padding}"
  setting-row:
    minHeight: "{spacing.settings-row-min-height}"
    borderColor: "{colors.divider}"
  button-primary:
    backgroundColor: "{colors.settings-accent}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  toggle-on:
    backgroundColor: "{colors.settings-accent}"
    textColor: "#FFFFFF"
    width: 44px
    height: 22px
    rounded: "{rounded.full}"
  toggle-off:
    backgroundColor: "{colors.switch-track-off}"
    textColor: "#FFFFFF"
    width: 44px
    height: 22px
    rounded: "{rounded.full}"
---

# Obsidian Drive Editor Design

## Overview

This interface should feel like a calm local Markdown workspace, not a web dashboard. The reference screenshot is Obsidian in dark mode: dense navigation on the left, a quiet writing surface in the center, metadata on the right, and thin desktop-style chrome around the edges. The emotional target is focused, low-friction, and familiar to people who already organize notes in folders.

Dark mode is the canonical experience. The UI should recede behind the document, using subtle tonal separation instead of decorative color, large cards, gradients, or marketing-style panels. The editor content is the most important element on the screen; navigation, metadata, sync state, and controls should be visible but visually quieter.

Use Korean and English content naturally. Korean filenames, headings, and metadata must preserve legibility at compact sizes.

## Colors

The palette is built from neutral dark layers with one restrained blue accent for links, focus, selected text, and sync affordances.

- **App background (`#1E1E1E`):** The main editor canvas and overall workspace foundation.
- **Panel background (`#252525`):** Sidebars and utility panels. It should be only slightly lighter than the editor.
- **Titlebar background (`#303030`):** Desktop chrome and tab surfaces.
- **Active item (`#3A3A3A`):** Current file, selected tab, and active row states.
- **Dividers (`#343434`):** Thin one-pixel boundaries between panes, never heavy outlines.
- **Primary text (`#EDEEF2`):** Headings, active filenames, body content.
- **Secondary text (`#C7C7C7`):** Standard navigation labels and metadata.
- **Muted text (`#9A9A9A`):** Breadcrumbs, inactive utility labels, secondary paths.
- **Accent (`#8AADF4`):** Links, focus rings, editor selections, and a small number of meaningful highlights.
- **Settings accent (`#8B5CF6`):** Primary settings actions, enabled toggles, and Obsidian-style preference links.

Avoid saturated color blocks. Status colors should appear as small notices, icons, borders, or text accents, not as full-width banners unless the message blocks the editing flow.

## Typography

Use the system UI stack with Inter when available. The UI should feel native to macOS and modern browsers while staying close to Obsidian's compact density.

- **Document title:** 28px, 700 weight, tight but readable. Use for the note title only.
- **Section headings:** 18px or smaller, 700 weight. Use sparingly inside panels.
- **Editor body:** 15px, 400 weight, 1.7 line height. This supports long-form Markdown and Korean text.
- **Sidebar labels:** 13px, 400 or 500 weight. Keep labels compact and scannable.
- **Metadata and utility labels:** 12px to 13px. Use muted color before reducing size further.
- **Code and identifiers:** Use a monospace stack at 13px for IDs, frontmatter values, and technical metadata.

Do not use negative letter spacing. Do not scale font sizes with viewport width.

## Layout

The desktop layout uses three stable columns:

- Left navigation: 260px wide for folder/file browsing.
- Center editor: fluid, minimum width 0, owns all remaining space.
- Right metadata panel: 280px wide for properties, tags, backlinks, or document intelligence.

The reference Obsidian screen also includes a very narrow activity rail on the far left. If this app adds one, keep it about 40px wide with icon-only controls and tooltips.

The center editor should have generous internal reading space without becoming a hero section. Use approximately 32px horizontal padding and 36px top padding for document content on desktop. On narrow screens, collapse panels before shrinking editor text. Prefer a single editor-first column on mobile with navigation and metadata available through drawers, tabs, or toggles.

Use thin dividers and tonal layers to communicate structure. Do not wrap the editor, sidebars, or whole page sections in floating cards.

## Elevation & Depth

Depth is flat and tonal. This design should not rely on shadows. Hierarchy comes from:

- Adjacent dark surfaces with small luminance differences.
- One-pixel dividers between persistent panes.
- Active and hover row fills.
- Text contrast and density.

Use shadows only for temporary overlays such as popovers, autocomplete menus, dropdowns, and modal dialogs. Even then, keep shadows soft and low contrast.

## Shapes

The shape language is compact and slightly softened.

- Pane boundaries are square.
- Sidebar rows, tabs, inputs, and buttons use 3px to 6px radii.
- Repeated cards are not part of the core workspace pattern.
- Avoid pill-shaped controls unless representing tags or compact filters.

Corners should never become a dominant visual theme. Obsidian-like utility surfaces should feel precise and quiet.

## Components

**Workspace Chrome**

The top chrome should be compact, dark, and utility-first. Tabs use the titlebar tone, with the active tab slightly brighter. Icons are monochrome and low contrast by default, brightening on hover or active state.

**Sidebar**

The sidebar is a dense file tree. It should support nested folders, disclosure arrows, active file highlighting, and long filenames without layout shifts. Use 6px to 8px row padding. Active rows use a filled background, not a left accent bar. Folder indentation should be clear but compact.

**Editor**

The editor is the visual anchor. Markdown headings, lists, tables, links, frontmatter, and code should be readable against the app background. The cursor should be high contrast. Selection should use a muted accent fill rather than a bright system blue.

**Metadata Panel**

The right panel is quieter than the document. It should show properties, tags, backlinks, word counts, or sync information in compact rows. Labels use muted text; values use primary or secondary text. Avoid large empty-state illustrations.

**Buttons and Inputs**

Buttons are secondary by default. Use filled dark controls with subtle borders. Primary actions may use the accent color, but only when the action is central and rare. Inputs should blend into panels and reveal stronger borders on focus.

**Settings Dialog**

Settings use a dedicated two-column dialog rather than the normal editor layout. The left column is a 250px preference navigation rail with grouped labels, Lucide icons, compact rows, and a filled active state. The right column is a scrollable content area with a max width around 736px and clear section headings.

Setting content is grouped into rounded tonal cards. Cards use about 20px padding, 8px radius, and subtle horizontal dividers between rows. Each setting row has a title, one-line helper copy, and a right-aligned control when applicable. Dense utility text is acceptable here; the screen is for configuration, not reading.

The close control sits in the top-right corner of the dialog as a muted icon-only button. The dialog may be nearly full-height on desktop, but it should still read as an overlay/panel with its own border and internal scroll area.

**Settings Controls**

Use Obsidian-style purple for settings primary actions, enabled toggles, and inline preference links. Secondary buttons remain dark gray with subtle borders. Select menus use dark filled controls, right-aligned in setting rows, with compact heights and clear focus states. Toggles are pill-shaped: purple track when enabled, gray track when disabled, white thumb in both states.

**Iconography**

Use **Lucide** as the default icon set for app chrome, navigation, toolbar actions, metadata controls, and editor utilities. Its thin rounded outline style matches the Obsidian reference better than filled, duotone, or heavy pictographic sets.

Default icons are 16px with 1.75 stroke width. Toolbar and sidebar controls may use 18px icons when the hit target remains compact. Icon-only buttons should have 28px square hit targets, subtle hover fills, and tooltips or accessible labels. Icons are muted by default and brighten only on hover, focus, active, or selected states.

Prefer familiar Lucide symbols such as `Search`, `FileText`, `Folder`, `FolderPlus`, `Plus`, `ChevronRight`, `ChevronDown`, `PanelLeft`, `PanelRight`, `Settings`, `Save`, `Check`, `AlertTriangle`, `RefreshCw`, `Link`, `Hash`, and `MoreHorizontal`. Do not mix icon sets on the same surface unless an integration brand mark is required.

**Notices and Save State**

Autosave, sync, and conflict states should be small and persistent. Place them near the bottom/status area or inline with the relevant control. Errors and remote conflicts need stronger color, but still within the quiet desktop style.

**Tables**

Markdown tables should use thin grid lines and compact cells. Headers may be slightly bolder but should not introduce heavy backgrounds.

## Do's and Don'ts

- Do keep the editor and file tree immediately usable on the first screen.
- Do use thin borders, compact spacing, and muted labels for utility surfaces.
- Do prioritize keyboard-driven, repeated workflows over presentation-style layouts.
- Do preserve clear active states for the current file, current tab, focused input, and selected editor text.
- Do make Korean filenames and headings readable at sidebar density.
- Do use Lucide icons for icon buttons and toolbar controls.
- Do present settings as a two-column dialog with grouped navigation and carded setting sections.
- Do use purple only for settings primary actions, enabled toggles, and inline preference links.
- Don't add landing-page heroes, decorative gradients, floating page cards, or large empty illustrations.
- Don't make the UI feel like a generic SaaS dashboard.
- Don't use accent color as broad decoration.
- Don't mix filled, duotone, emoji, and outline icon styles in the same workspace.
- Don't make settings rows taller or more spacious than necessary; preserve Obsidian's compact preference density.
- Don't center the editor in a card or add ornamental frames around the writing area.
- Don't hide sync/conflict states behind ambiguous color alone; include text or an icon.

## Responsive Behavior

At desktop widths, show navigation, editor, and metadata together. Below tablet width, keep the editor primary and collapse the right metadata panel first. On mobile, present a single-column editor with file navigation and metadata behind explicit controls.

Text must never overlap icons or controls. Long filenames, paths, tags, and metadata values should truncate with ellipsis in navigation surfaces and wrap in detail views.

## Agent Prompt Guide

When implementing UI from this design file:

- Treat this document as the visual source of truth for the workspace.
- Reuse existing CSS variables before adding new tokens.
- Prefer deletion and simplification over decorative additions.
- Build the working editor surface first, then navigation and metadata affordances.
- Verify desktop and mobile layouts with screenshots after significant visual changes.
- If exact Obsidian parity is requested, compare against a fresh screenshot before editing.
