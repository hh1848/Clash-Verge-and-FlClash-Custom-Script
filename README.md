<div align="center">

# Clash Verge Rev & Bettbox Custom Script

**一套 Mihomo 覆写脚本，让你换机场时不用重改配置。**

[![Clash Verge Rev](https://img.shields.io/badge/Clash%20Verge%20Rev-支持-2f81f7)](./Clash-Verge-Rev-mihomoScript.js)
[![Bettbox](https://img.shields.io/badge/Bettbox%20(Android)-支持-3ddc84)](./Bettbox-mihomoScript.js)
[![Mihomo](https://img.shields.io/badge/内核-Mihomo-orange)](https://github.com/MetaCubeX/mihomo)

</div>

> [!IMPORTANT]
> 本仓库只提供 Mihomo 配置覆写脚本，**不提供任何代理节点、机场订阅、网络接入或售卖服务**。

---

## 项目简介

大多数机场订阅自带的代理组和规则各不相同、质量参差。这套脚本的做法是：

> **保留你当前机场的 `proxies` / `proxy-providers` 节点，把代理组、分流规则、Rule Providers、DNS 全部重建为一套统一结构。**

所以你换任何机场，看到的都是同一套代理组和分流逻辑，节点还是那个机场自己的节点。脚本里**不需要填任何机场 URL**，也不含任何节点信息。

新版脚本延续"统一骨架"思路，但对结构做了大幅精简：

- **26 个策略组**（6 基础 + 3 AI + 8 国际服务 + 9 地区），去掉了故障转移、负载均衡等重型组
- **26 条分流规则** + **20 个 Rule Providers**（全部来自 [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat) 的 `.mrs` 格式，每日自动更新）
- ChatGPT / Claude / Gemini & NotebookLM 三大 AI 服务独立分流，NotebookLM 精确域名优先于通用 Google
- Bettbox 版支持 **v1.18.8+ 可视化覆写开关**：在 App 界面上直接启停各服务分流，关闭后流量自动回落"国外流量"

---

## 适用环境

| 客户端 | 平台 | 脚本 | 说明 |
| --- | --- | --- | --- |
| **Clash Verge Rev** | Windows / macOS / Linux | [`Clash-Verge-Rev-mihomoScript.js`](./Clash-Verge-Rev-mihomoScript.js) | 桌面版，含 TUN 参数补充 |
| **Bettbox**（v1.18.8+） | Android | [`Bettbox-mihomoScript.js`](./Bettbox-mihomoScript.js) | 安卓版，支持可视化覆写开关 |

两版脚本的分流逻辑、代理组结构、DNS 完全一致，差异只在平台适配项（详见[两版脚本差异](#两版脚本差异)）。

必须使用 **Mihomo 内核**的客户端。旧版 Clash Premium 或不支持 `include-all`、Rule Providers 等 Mihomo 特性的客户端不适用。

---

## 安装与配置

### Clash Verge Rev（桌面版）

1. 正常导入机场订阅
2. `订阅` → **全局扩展脚本**（注意是 Script，不是「全局扩展覆写配置 / Merge」）
3. 复制 [`Clash-Verge-Rev-mihomoScript.js`](./Clash-Verge-Rev-mihomoScript.js) 全文粘贴进去，保存
4. 刷新订阅，代理页出现 `全球手动` / `默认代理` / `漏网之鱼` 等代理组即生效

### Bettbox（Android）

1. 正常导入机场订阅
2. 在脚本覆写入口（`设置 → 高级设置 → 脚本`，或 `配置 → 订阅 → 覆写 → 脚本`，以 App 内实际界面为准）新建 JavaScript 覆写
3. 复制 [`Bettbox-mihomoScript.js`](./Bettbox-mihomoScript.js) 全文粘贴保存，并关联到当前订阅
4. 刷新订阅。Bettbox v1.18.8+ 会在覆写页展示脚本声明的可视化开关（ChatGPT、Claude、地区分组等 12 项）

### Raw 地址

```text
https://raw.githubusercontent.com/hh1848/Clash-Verge-and-Bettbox-Custom-Script/main/Clash-Verge-Rev-mihomoScript.js
https://raw.githubusercontent.com/hh1848/Clash-Verge-and-Bettbox-Custom-Script/main/Bettbox-mihomoScript.js
```

> Raw 地址用于查看或同步脚本源码，**不是订阅地址**，不要填进客户端的订阅框。

---

## 工作原理

```text
机场订阅
   ├── proxies ──────────┐
   └── proxy-providers ──┤  ← 节点全部保留，一个不删
                         ▼
                  自定义覆写脚本
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
  proxy-groups         rules         rule-providers
   (26 个)           (26 条)           (20 个)
        │
        └── dns（Fake-IP + 国内外分流）
                         │
                         ▼
                  最终 Mihomo 配置
```

**脚本不会把多个机场合并成一个。** 它的作用是让不同机场套用同一套骨架：

```text
机场 A ─┐
机场 B ─┼─→ 同一份覆写脚本 → 相同的代理组 / DNS / 规则结构
机场 C ─┘
```

切到哪个机场，用的就是那个机场自己的节点。

### 配置规模

| 项目 | Clash Verge Rev | Bettbox (Android) |
| --- | --- | --- |
| 代理组 | **26** | **26** |
| 分流规则 | **26** | **26** |
| Rule Providers | **20** | **20** |

---

## 代理组架构

### 基础组（6 个）

| 代理组 | 类型 | 用途 |
| --- | --- | --- |
| `全球手动` | `select` | 手动挑选具体节点，始终排第一；已过滤机场伪节点并按地区排序 |
| `默认代理` | `select` | 默认代理入口，可选 `自动选择` / `全球手动` / 各地区组 / `DIRECT` |
| `自动选择` | `url-test` | 全部节点自动测速选最优，间隔 300（Verge）/ 600（Bettbox）秒，容差 80ms |
| `国内直连` | `select` | 默认 `DIRECT`；手动切到 `默认代理` 可让国内流量临时走代理 |
| `国外流量` | `select` | 通用国外流量出口，也是各服务组开关关闭后的回落目标 |
| `漏网之鱼` | `select` | 最终 `MATCH` 落点，默认走 `国外流量` |

### 服务分流组（11 个）

全部为 `select` 类型，可在 `国外流量` / `默认代理` / `自动选择` / `全球手动` / 各地区组 / `DIRECT` 之间自由切换：

| 代理组 | 用途 |
| --- | --- |
| `ChatGPT` | OpenAI |
| `Claude` | Anthropic |
| `Gemini / NotebookLM` | Gemini、AI Studio、NotebookLM、AI 开发接口 |
| `Google` | Google 通用服务 |
| `GitHub` | GitHub |
| `Microsoft` | Microsoft |
| `Apple` | Apple 国际服务（中国区业务走直连，见分流规则） |
| `Telegram` | Telegram |
| `X` | Twitter / X |
| `YouTube` | YouTube |
| `Netflix` | Netflix |

### 地区组（9 个）

脚本按关键词识别 **8 个地区**，每组是一个自动测速的 `url-test`；识别不到的节点统一进入 **`其他地区`**（排除式过滤，收留其余全部节点）：

`🇭🇰 香港` · `🇲🇴 澳门` · `🇹🇼 台湾` · `🇰🇷 韩国` · `🇸🇬 新加坡` · `🇯🇵 日本` · `🇺🇸 美国` · `🇪🇺 欧洲` · `其他地区`

> Bettbox 版可在覆写开关里关闭 **`地区分组`**：9 个地区组全部移除，其他策略组中对地区组的引用一并清理，不影响其余分流。

### Bettbox 可视化覆写开关

Bettbox 版脚本顶部声明了两组客户端可见的全局变量：

- `ruleOptionsEnable` —— 12 个开关（11 个服务组 + `地区分组`），默认全部启用
- `serviceConfigs` —— 各开关在 App 界面上显示的图标

联动逻辑：

| 操作 | 结果 |
| --- | --- |
| 关闭某个服务开关（如 `Netflix: false`） | 对应策略组从配置中移除，原指向它的分流规则自动回落到 `国外流量` |
| 关闭 `地区分组` | 9 个地区组全部移除，`默认代理` / `国外流量` / 各服务组中的地区选项一并清理 |
| 全部保持默认 | 行为与 Clash Verge Rev 版完全一致 |

---

## 节点识别与排序

### 地区识别关键词

节点名称通过中文名、emoji 旗帜、英文全称和缩写识别：

| 地区 | 识别关键词 |
| --- | --- |
| 香港 | 🇭🇰 · 香港 · `Hong Kong` · `HK` / `HKG` |
| 澳门 | 🇲🇴 · 澳门 / 澳門 · `Macao` / `Macau` · `MO` |
| 台湾 | 🇹🇼 · 台湾 / 台灣 · `Taiwan` · `Taipei` · `TW` / `TWN` |
| 韩国 | 🇰🇷 · 韩国 / 韓國 · `Korea` · `Seoul` · `KR` / `KOR` |
| 新加坡 | 🇸🇬 · 新加坡 / 狮城 / 獅城 · `Singapore` · `SG` / `SGP` |
| 日本 | 🇯🇵 · 日本 · 东京 / 東京 · 大阪 · `Japan` · `Tokyo` · `Osaka` · `JP` / `JPN` |
| 美国 | 🇺🇸 · 美国 / 美國 · `United States` · `America` · 洛杉矶 / 圣何塞 / 西雅图 / 纽约 / 凤凰城 · `Los Angeles` · `San Jose` · `Seattle` · `New York` · `Phoenix` · `PHX` · `US` / `USA` |
| 欧洲 | 🇪🇺 · 欧洲 / 歐洲 · 英 / 法 / 德 / 荷 / 西 / 意 / 瑞 / 芬 / 挪 / 波 / 爱尔兰 · `Europe` · `London` · `Paris` · `Frankfurt` · `Amsterdam` · `Madrid` · `Milan` · `Zurich` · `Stockholm` · `Helsinki` · `Oslo` · `Warsaw` · `Dublin` · `EU` · `UK` · `GB` · `DE` · `FR` · `NL` |

### 全球手动排序

`全球手动` 组会先**剔除机场公告类伪节点**（命中即排除）：

```text
到期 · 过期 · 剩余 · 流量 · 套餐 · 官网 · 网址 · 订阅 · 重置
Expire · Expired · Traffic · Remaining · Website
```

再按固定地区顺序重排：**香港 → 澳门 → 台湾 → 韩国 → 新加坡 → 日本 → 美国 → 欧洲 → 其他**，同地区内按数字自然排序（`节点1`、`节点2`…… `节点10` 不会乱序）。

> 排序只作用于 `config.proxies` 里的内联节点。若机场使用 `proxy-providers`，Bettbox 版会让 `全球手动` 通过 `include-all` 由 Mihomo 运行时动态纳入全部节点（含 provider 节点），避免订阅更新后节点丢失，此模式下节点顺序由内核决定。

---

## 分流规则说明

共 **26 条**，自上而下匹配，命中即停：

| 顺序 | 规则 | 目标 | 条数 |
| --- | --- | --- | --- |
| 1 | `RULE-SET:private`（局域网域名） | `国内直连` | 1 |
| 2 | NotebookLM / Gemini 精确域名：`notebooklm.google` · `notebooklm.google.com` · `aistudio.google.com` · `ai.google.dev` · `generativelanguage.googleapis.com` | `Gemini / NotebookLM` | 5 |
| 3 | `RULE-SET:openai` | `ChatGPT` | 1 |
| 4 | `RULE-SET:anthropic` | `Claude` | 1 |
| 5 | `RULE-SET:google-gemini` | `Gemini / NotebookLM` | 1 |
| 6 | `RULE-SET:apple@cn` — 中国区 Apple 业务 | `国内直连` | 1 |
| 7 | `RULE-SET:cn` — 中国大陆域名 | `国内直连` | 1 |
| 8 | `youtube` / `google` / `github` / `microsoft` / `apple` / `telegram` / `x` / `netflix` | 对应服务组 | 8 |
| 9 | IP 规则集：`private` → `国内直连`；`google` / `telegram` / `twitter` / `netflix` → 对应服务组；`cn` → `国内直连`（全部带 `no-resolve`） | 对应组 | 6 |
| 末 | `MATCH` | `漏网之鱼` | 1 |
| — | **合计** | — | **26** |

两个刻意设计：

- **NotebookLM / Gemini 精确域名（第 2 组）排在通用 Google（第 8 组）之前**。否则 `google` 规则集会先把 Gemini 相关域名抢走，AI 服务无法独立分流。`generativelanguage.googleapis.com` 也因此不会被 `googleapis.com` 泛化规则带偏。
- **中国区 Apple（`apple@cn`）在大陆域名（`cn`）与国际 Apple（`apple`）之前**，保证 App Store / iCloud 国内业务直连，其余 Apple 流量才进 `Apple` 组。

### Rule Providers

20 个，全部为 `http` + `.mrs` 格式（Mihomo 二进制规则集，体积小、加载快），来源统一为 [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat)，经 jsDelivr CDN 分发，更新间隔 `86400` 秒（每天一次），本地缓存到 `./ruleset/skull/`：

| 类型 | 规则集 | 数量 |
| --- | --- | --- |
| 域名（`behavior: domain`） | `private` · `cn` · `openai` · `anthropic` · `google-gemini` · `google` · `github` · `microsoft` · `apple@cn` · `apple` · `telegram` · `x` · `youtube` · `netflix` | 14 |
| IP 段（`behavior: ipcidr`） | `private` · `cn` · `google` · `telegram` · `twitter` · `netflix` | 6 |

> 脚本本身不含规则数据，首次加载需联网拉取。若 CDN 不可达，对应规则集加载失败，相关流量将落到后续规则或 `漏网之鱼`。
> 机场订阅自带的 `rule-providers` 会被合并保留，但规则已全部重建为 `SKULL_*` 系列，不再引用机场自带规则集。

### DNS

启用 Fake-IP + 按分流规则解析（`respect-rules`），两版脚本完全一致：

```yaml
enable: true
ipv6: false              # 与脚本整体关闭 IPv6 的策略一致
enhanced-mode: fake-ip
fake-ip-range: 198.18.0.1/16
respect-rules: true
```

| 用途 | 服务器 |
| --- | --- |
| Bootstrap（`default-nameserver`） | `223.5.5.5` · `119.29.29.29` |
| 国外 / 默认（`nameserver`） | Cloudflare DoH · Google DoH |
| 国内域名（`nameserver-policy`，命中 `cn` / `private` 规则集时） | 阿里 DoH · 腾讯 `doh.pub` |
| 代理节点域名（`proxy-server-nameserver`） | 阿里 DoH · 腾讯 `doh.pub` |

**Fake-IP Filter**：在机场原有配置基础上追加 7 条，命中的域名走真实解析（局域网发现、时间同步、QQ 登录等场景必需）：

```text
*.lan · *.local · localhost.ptlogin2.qq.com
time.*.com · time.*.gov · time.*.edu.cn · ntp.*.com
```

### 常规参数

```yaml
mode: rule
unified-delay: true        # 统一延迟估算，剔除握手差异
tcp-concurrent: true       # TCP 并发连接
profile:
  store-selected: true     # 记住各代理组的手动选择
  store-fake-ip: true      # 持久化 Fake-IP 映射
```

| 参数 | Clash Verge Rev | Bettbox (Android) |
| --- | --- | --- |
| TUN | 在客户端现有 `tun` 配置上合并补充：`stack: mixed` · `auto-route` · `strict-route` · `auto-detect-interface` · `dns-hijack: [any:53, tcp://any:53]`；**是否启用仍由客户端开关决定** | **完全不修改**。Android 的 TUN / VPN 生命周期由 Bettbox 自身接管，脚本越权覆写会与 App 冲突 |
| `find-process-mode` | `strict`（仅规则需要时查进程） | `off`（安卓不做进程级分流，关闭省电） |
| 顶层 `ipv6` | 不设置 | `false` |

---

## 两版脚本差异

| 项目 | Clash Verge Rev | Bettbox (Android) | 原因 |
| --- | --- | --- | --- |
| 可视化覆写开关 | 无 | 12 个开关 + 图标（v1.18.8+） | Bettbox 原生支持，服务组可按需启停 |
| `全球手动` 对 provider 订阅的处理 | 内联节点排序；无内联节点时 `include-all` 兜底 | 存在 `proxy-providers` 时**强制 `include-all`**，节点由内核动态纳入 | Android 订阅多为 provider 形态，静态排序会在订阅更新后丢失 provider 节点 |
| 节点排序实现 | `localeCompare("zh-CN")` | 自实现数字自然比较 | Bettbox 的 JS 引擎（QuickJS）不保证 `Intl` 可用 |
| `url-test` 测速间隔 | `300` 秒 | `600` 秒 | 移动端省电、减少唤醒 |
| `find-process-mode` | `strict` | `off` | 桌面保留进程查询能力；安卓无进程分流需求 |
| TUN | 合并补充参数（不改变启用状态） | 不碰 `tun` | 平台机制不同 |
| 顶层 `ipv6` | 不设置 | `false` | 安卓网络环境更复杂，显式关闭 |
| 代理组 / 规则 / Rule Providers | 26 / 26 / 20 | 26 / 26 / 20 | 分流结构完全一致 |

---

## 使用示例

**让 ChatGPT 固定走美国节点**

代理页 → `ChatGPT` 组 → 选 `🇺🇸 美国`。`美国` 组内是自动测速的美国节点，延迟最优自动切换。Claude、Gemini / NotebookLM 同理，互不影响。

**临时让国内流量也走代理**

代理页 → `国内直连` 组 → 由 `DIRECT` 切到 `默认代理`。所有目标为 `国内直连` 的流量（大陆域名、中国区 Apple、局域网）都会改走代理；切回 `DIRECT` 即恢复。

**关闭不需要的服务分流（仅 Bettbox）**

覆写开关页把 `Netflix` 关掉 → `Netflix` 组消失，原本走 Netflix 规则集的流量自动改走 `国外流量`。想恢复就再打开。

**换机场**

不用改脚本。Clash Verge Rev 换订阅后全局扩展脚本自动重新执行；Bettbox 把新订阅关联到同一个覆写脚本即可。

**更新脚本**

脚本更新后，重新复制对应文件内容覆盖客户端里的旧脚本，然后刷新一次订阅让配置重新生成。

---

## 注意事项

<details>
<summary><b>配置里一个节点都没有会怎样？</b></summary>

脚本有空配置保护：`proxies` 和 `proxy-providers` 都为空时**直接原样返回**，不做任何修改——避免订阅拉取失败时把配置清空。

</details>

<details>
<summary><b>能同时用多个机场吗？</b></summary>

可以，但脚本**不会把多个机场的节点合并到一个配置里**。每个机场各自套用同一套代理组和规则结构，切换配置时用的是当前机场的节点。

</details>

<details>
<summary><b>为什么有些节点没按地区排序？</b></summary>

排序只作用于 `config.proxies` 的内联节点。机场若使用 `proxy-providers`，provider 节点由 Mihomo 运行时纳入，顺序由内核决定。

</details>

<details>
<summary><b>规则集拉取失败怎么办？</b></summary>

Rule Providers 走 jsDelivr CDN，首次加载需要联网。若不可达，对应规则集为空，相关流量会落到后续规则或 `漏网之鱼`；网络恢复后客户端会按 `interval` 自动重试更新。

</details>

<details>
<summary><b>Bettbox 上开关关了但分流没变？</b></summary>

确认订阅已重新刷新（脚本需重新执行才能生效），以及 Bettbox 版本 ≥ 1.18.8——可视化覆写开关是该版本的特性。

</details>

<details>
<summary><b>IPv6 相关</b></summary>

DNS 层两版均 `ipv6: false`；Bettbox 版另在顶层强制 `ipv6: false`。在无 IPv6 路由的网络下返回 AAAA 记录只会拖慢连接，这是刻意关闭，不是遗漏。

</details>

---

## 致谢

部分设计、规则与资源参考自以下开源项目：

- [Mihomo](https://github.com/MetaCubeX/mihomo) — 内核
- [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat) — 全部规则集
- [Koolson/Qure](https://github.com/Koolson/Qure) · [0xWans/Qure](https://github.com/0xWans/Qure) · [lobehub/lobe-icons](https://github.com/lobehub/lobe-icons) — 图标资源

---

## Disclaimer

本项目仅用于 Mihomo 配置研究、学习与个人网络配置管理。

使用者应自行确保：

- 遵守所在国家或地区的法律法规
- 遵守网络服务提供商及相关平台的服务条款
- 自行判断第三方 Rule Provider 的可用性与安全性
- 自行承担配置修改造成的网络异常

**本项目不提供任何代理节点、机场订阅或相关网络服务。**
