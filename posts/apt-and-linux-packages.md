---
title: How Linux Package Management Actually Works
slug: how-linux-package-management-actually-works
date: 2026-04-07
tags: tech
excerpt: How Linux Package Management Actually Works
---


*learned by doing — March 2026*

---

## The Big Picture

Installing software on Linux isn't magic. It's a simple, decentralised system that any person can fully understand — and once you do, it demystifies everything from broken installs to missing packages.

The whole system has three moving parts: **repositories**, the **apt tool**, and **.deb package files**. Everything else is a detail.

> **Mental model:** Think of it like a phone app store — except there's no single company in charge. Anyone can run their own "store", and your machine keeps a local catalogue of everything available across all stores it knows about.

---

## 1. Repositories (Repos)

A repository is just a server on the internet that hosts packages and a catalogue of what's available. Linux Mint ships with a handful of official repos pre-configured — covering thousands of packages maintained by the Mint and Ubuntu teams.

But any vendor can run their own repo. ProtonVPN does. Docker does. Google does (for Chrome). There's no central authority vetting these — which is both the strength and the risk of the system.

Mint is built on top of Ubuntu, so it piggybacks on Ubuntu's enormous package catalogue. That's why common tools like `git`, `curl`, `python`, or `hello` are available without any extra setup.

---

## 2. The Sources List — apt's Address Book

Your machine maintains a list of all repos it knows about. This lives in two places:

- `/etc/apt/sources.list` — the main file (often mostly empty on modern Mint)
- `/etc/apt/sources.list.d/` — a folder of individual `.list` files, one per repo

```
$ ls /etc/apt/sources.list.d/

antigravity.list   cursor.list    docker.list
google-chrome.list mullvad.list   protonvpn-stable.list
tailscale.list     official-package-repositories.list
```

Every entry in this folder (except `official-package-repositories.list`) is something that was manually added at some point — Docker, Chrome, Mullvad, ProtonVPN. The history of your installed third-party software is right there in plain text.

> **Key insight:** When you add a new repo by installing a `.deb` release file, all it does is drop a new `.list` file into `sources.list.d/`. That's the entire trick.

---

## 3. `apt update` — Refreshing the Catalogue

`sudo apt update` does **not** install or upgrade anything. It reaches out to every repo in your sources list and downloads a fresh copy of their package catalogue to your local machine.

Each repo serves a pre-built catalogue file containing the metadata for every package it hosts — name, version, dependencies, download size, architecture. Without a fresh catalogue, apt wouldn't know what versions are available or where to download them.

The catalogues are cached locally at `/var/lib/apt/lists/`.

This is why adding a new repo always requires running `apt update` immediately after — apt needs to fetch that new repo's catalogue before it can see any of its packages.

---

## 4. .deb Files — What's Actually Inside

A `.deb` file is just an archive (like a zip file with a specific format). Crack one open with `ar xv package.deb` and you'll find exactly three things:

| File | Contents |
|------|----------|
| `debian-binary` | The format version number. Usually just "2.0". |
| `control.tar.zst` | Package metadata: name, version, maintainer, **dependencies**, description. |
| `data.tar.zst` | The actual files to place on your system — binaries, libraries, configs, man pages. |

The `control` file inside `control.tar.zst` is where dependencies live:

```
Package: hello
Version: 2.10-3build1
Architecture: amd64
Depends: libc6 (>= 2.38)
Description: example package based on GNU hello
```

Every package declares what it needs. `apt` reads these declarations and figures out the full install order automatically before downloading anything.

---

## 5. apt vs dpkg — Two Different Layers

These are often confused. They operate at different levels:

| Tool | What it does | Knows about repos? | Resolves dependencies? |
|------|--------------|--------------------|------------------------|
| `dpkg` | Unpacks a single .deb and places its contents on disk | No | No — will just fail or break |
| `apt` | Talks to repos, resolves dependencies, fetches everything needed, then calls dpkg | Yes | Yes — automatically |

**apt is a smart wrapper around dpkg.** When you run `apt install something`, apt figures out what needs to happen and dpkg does the actual unpacking. You rarely need to use dpkg directly — the main case is manually installing a standalone `.deb` file you downloaded yourself.

---

## 6. The Full Flow — How It All Connects

Here's the complete journey from "I want ProtonVPN" to "it's installed":

```
Add repo          apt update        apt install       Fetch .deb        dpkg -i
(dpkg -i          (fetch            (resolve          (from vendor      (unpack
 release.deb)      catalogue)        deps)             repo)             to disk)
```

For packages already in the official repos (like `hello`, `git`, `curl`), the first step is already done — skip straight to `apt install`.

> **The key insight:** There is no central authority. No single company controls what packages exist or who can distribute them. Your machine just has a list of servers it trusts, and apt talks to those servers directly. The Software Center in the GUI is the same system — just a friendlier face on top of exactly this.

---

## Quick Reference

| Command | What it actually does |
|---------|-----------------------|
| `apt update` | Refreshes local package catalogues from all repos. Installs nothing. |
| `apt install foo` | Finds foo in catalogue, resolves dependencies, fetches .deb files, calls dpkg to install. |
| `apt search foo` | Searches the local catalogue. Shows results from ALL repos in sources.list.d. |
| `apt upgrade` | Upgrades all installed packages to their newest catalogue versions. |
| `dpkg -i foo.deb` | Directly unpacks a local .deb file onto disk. No dependency resolution. |
| `ar xv foo.deb` | Crack open a .deb archive to inspect its raw contents. |
