const Compatible_With_Bettbox = { ruleOptionsEnable: true };

// Bettbox v1.18.8+ 可视化覆写开关；默认全部启用，关闭后对应流量回落到“国外流量”。
var ruleOptionsEnable = {
  ChatGPT: true,
  Claude: true,
  "Gemini / NotebookLM": true,
  Google: true,
  GitHub: true,
  Microsoft: true,
  Apple: true,
  Telegram: true,
  X: true,
  YouTube: true,
  Netflix: true,
  "地区分组": true
};

// Bettbox 会读取该数组，为可视化开关显示对应图标。
var serviceConfigs = [
  { name: "ChatGPT", icon: "https://fastly.jsdelivr.net/gh/lobehub/lobe-icons@master/packages/static-png/light/openai.png" },
  { name: "Claude", icon: "https://fastly.jsdelivr.net/gh/lobehub/lobe-icons@master/packages/static-png/light/claude-color.png" },
  { name: "Gemini / NotebookLM", icon: "https://fastly.jsdelivr.net/gh/lobehub/lobe-icons@master/packages/static-png/light/gemini-color.png" },
  { name: "Google", icon: "https://fastly.jsdelivr.net/gh/0xWans/Qure@master/IconSet/Color/Google_Search.png" },
  { name: "GitHub", icon: "https://fastly.jsdelivr.net/gh/0xWans/Qure@master/IconSet/Color/GitHub.png" },
  { name: "Microsoft", icon: "https://fastly.jsdelivr.net/gh/0xWans/Qure@master/IconSet/Color/Microsoft.png" },
  { name: "Apple", icon: "https://fastly.jsdelivr.net/gh/0xWans/Qure@master/IconSet/Color/Apple.png" },
  { name: "Telegram", icon: "https://fastly.jsdelivr.net/gh/0xWans/Qure@master/IconSet/Color/Telegram.png" },
  { name: "X", icon: "https://fastly.jsdelivr.net/gh/0xWans/Qure@master/IconSet/Color/Twitter(X).png" },
  { name: "YouTube", icon: "https://fastly.jsdelivr.net/gh/0xWans/Qure@master/IconSet/Color/YouTube.png" },
  { name: "Netflix", icon: "https://fastly.jsdelivr.net/gh/0xWans/Qure@master/IconSet/Color/Netflix.png" },
  { name: "地区分组", icon: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/World_Map.png" }
];

// Bettbox Android 全局覆写脚本
// 目标：国内直连、国外代理；ChatGPT / Claude / Gemini & NotebookLM 独立；常用国际服务独立；地区自动测速。
// 用法：设置 -> 高级设置 -> 脚本；配置 -> 订阅 -> 覆写 -> 脚本。

function main(config) {
  // Bettbox / QuickJS 安全初始化
  config = config || {};

  const featureEnabled = (name) =>
    !ruleOptionsEnable || ruleOptionsEnable[name] !== false;

  const serviceTarget = (name) =>
    featureEnabled(name) ? name : "国外流量";
  // ---------- 0. 基础检查：保留机场 proxies / proxy-providers ----------
  const directProxyCount = Array.isArray(config.proxies) ? config.proxies.length : 0;
  const providers = config["proxy-providers"];
  const providerCount = providers && typeof providers === "object"
    ? Object.keys(providers).length
    : 0;

  if (directProxyCount === 0 && providerCount === 0) {
    return config;
  }

  const TEST_URL = "https://www.gstatic.com/generate_204";
  const INTERVAL = 600;
  const RULE_INTERVAL = 86400;

  // 排除机场的流量信息、到期提醒等伪节点
  const EXCLUDE = "(?i)(到期|过期|剩余|流量|套餐|官网|网址|订阅|重置|Expire|Expired|Traffic|Remaining|Website)";

  // ---------- 1. 图标 ----------
  const ICON = {
    default:
      "https://fastly.jsdelivr.net/gh/0xWans/Qure@master/IconSet/Color/Rocket.png",

    foreign:
      "https://fastly.jsdelivr.net/gh/0xWans/Qure@master/IconSet/Color/Global.png",

    manual:
      "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Proxy.png",

    auto:
      "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Auto.png",

    direct:
      "https://flagcdn.com/w160/cn.png",

    final:
      "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Final.png",

    chatgpt:
      "https://fastly.jsdelivr.net/gh/lobehub/lobe-icons@master/packages/static-png/light/openai.png",
    claude:
      "https://fastly.jsdelivr.net/gh/lobehub/lobe-icons@master/packages/static-png/light/claude-color.png",
    gemini:
      "https://fastly.jsdelivr.net/gh/lobehub/lobe-icons@master/packages/static-png/light/gemini-color.png",

    google:
      "https://fastly.jsdelivr.net/gh/0xWans/Qure@master/IconSet/Color/Google_Search.png",
    github:
      "https://fastly.jsdelivr.net/gh/0xWans/Qure@master/IconSet/Color/GitHub.png",
    microsoft:
      "https://fastly.jsdelivr.net/gh/0xWans/Qure@master/IconSet/Color/Microsoft.png",
    apple:
      "https://fastly.jsdelivr.net/gh/0xWans/Qure@master/IconSet/Color/Apple.png",
    telegram:
      "https://fastly.jsdelivr.net/gh/0xWans/Qure@master/IconSet/Color/Telegram.png",
    x:
      "https://fastly.jsdelivr.net/gh/0xWans/Qure@master/IconSet/Color/Twitter(X).png",
    youtube:
      "https://fastly.jsdelivr.net/gh/0xWans/Qure@master/IconSet/Color/YouTube.png",
    netflix:
      "https://fastly.jsdelivr.net/gh/0xWans/Qure@master/IconSet/Color/Netflix.png",

    hk: "https://flagcdn.com/w160/hk.png",
    mo: "https://flagcdn.com/w160/mo.png",
    tw: "https://flagcdn.com/w160/tw.png",
    kr: "https://flagcdn.com/w160/kr.png",
    sg: "https://flagcdn.com/w160/sg.png",
    jp: "https://flagcdn.com/w160/jp.png",
    us: "https://flagcdn.com/w160/us.png",
    eu: "https://flagcdn.com/w160/eu.png",

    // 美化：其他地区
    other:
      "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/World_Map.png"
  };

  // ---------- 2. 节点地区筛选 ----------
  const FILTER = {
    hk: "(?i)(🇭🇰|香港|Hong ?Kong|\\bHK(G)?\\b)",
    mo: "(?i)(🇲🇴|澳门|澳門|Macao|Macau|\\bMO\\b)",
    tw: "(?i)(🇹🇼|台湾|台灣|Taiwan|Taipei|\\bTW(N)?\\b)",
    kr: "(?i)(🇰🇷|韩国|韓國|Korea|Seoul|\\bKR\\b|\\bKOR\\b)",
    sg: "(?i)(🇸🇬|新加坡|狮城|獅城|Singapore|\\bSG(P)?\\b)",
    jp: "(?i)(🇯🇵|日本|东京|東京|大阪|Japan|Tokyo|Osaka|\\bJP(N)?\\b)",
    us: "(?i)(🇺🇸|美国|美國|United ?States|America|Los ?Angeles|San ?Jose|Seattle|New ?York|Phoenix|凤凰城|\\bPHX\\b|\\bUS(A)?\\b)",
    eu: "(?i)(🇪🇺|欧洲|歐洲|Europe|European|英国|英國|法国|法國|德国|德國|荷兰|荷蘭|西班牙|意大利|瑞士|瑞典|芬兰|挪威|波兰|爱尔兰|London|Paris|Frankfurt|Amsterdam|Madrid|Milan|Zurich|Stockholm|Helsinki|Oslo|Warsaw|Dublin|\\bEU\\b|\\bUK\\b|\\bGB(R)?\\b|\\bDE(U)?\\b|\\bFR(A)?\\b|\\bNL(D)?\\b)"
  };

  const OTHER_EXCLUDE =
    "(?i)(到期|过期|剩余|流量|套餐|官网|网址|订阅|重置|Expire|Expired|Traffic|Remaining|Website|🇭🇰|香港|Hong ?Kong|\\bHK(G)?\\b|🇲🇴|澳门|澳門|Macao|Macau|\\bMO\\b|🇹🇼|台湾|台灣|Taiwan|Taipei|\\bTW(N)?\\b|🇰🇷|韩国|韓國|Korea|Seoul|\\bKR\\b|\\bKOR\\b|🇸🇬|新加坡|狮城|獅城|Singapore|\\bSG(P)?\\b|🇯🇵|日本|东京|東京|大阪|Japan|Tokyo|Osaka|\\bJP(N)?\\b|🇺🇸|美国|美國|United ?States|America|Los ?Angeles|San ?Jose|Seattle|New ?York|Phoenix|凤凰城|\\bPHX\\b|\\bUS(A)?\\b|🇪🇺|欧洲|歐洲|Europe|European|英国|英國|法国|法國|德国|德國|荷兰|荷蘭|西班牙|意大利|瑞士|瑞典|芬兰|挪威|波兰|爱尔兰|London|Paris|Frankfurt|Amsterdam|Madrid|Milan|Zurich|Stockholm|Helsinki|Oslo|Warsaw|Dublin|\\bEU\\b|\\bUK\\b|\\bGB(R)?\\b|\\bDE(U)?\\b|\\bFR(A)?\\b|\\bNL(D)?\\b)";

  // 全球手动节点固定排序：香港 -> 澳门 -> 台湾 -> 韩国 -> 新加坡 -> 日本 -> 美国 -> 欧洲 -> 其他地区。
  const MANUAL_REGION_TESTS = [
    /(?:🇭🇰|香港|Hong ?Kong|\bHK(?:G)?\b)/i,
    /(?:🇲🇴|澳门|澳門|Macao|Macau|\bMO\b)/i,
    /(?:🇹🇼|台湾|台灣|Taiwan|Taipei|\bTW(?:N)?\b)/i,
    /(?:🇰🇷|韩国|韓國|Korea|Seoul|\bKR\b|\bKOR\b)/i,
    /(?:🇸🇬|新加坡|狮城|獅城|Singapore|\bSG(?:P)?\b)/i,
    /(?:🇯🇵|日本|东京|東京|大阪|Japan|Tokyo|Osaka|\bJP(?:N)?\b)/i,
    /(?:🇺🇸|美国|美國|United ?States|America|Los ?Angeles|San ?Jose|Seattle|New ?York|Phoenix|凤凰城|\bPHX\b|\bUS(?:A)?\b)/i,
    /(?:🇪🇺|欧洲|歐洲|Europe|European|英国|英國|法国|法國|德国|德國|荷兰|荷蘭|西班牙|意大利|瑞士|瑞典|芬兰|挪威|波兰|爱尔兰|London|Paris|Frankfurt|Amsterdam|Madrid|Milan|Zurich|Stockholm|Helsinki|Oslo|Warsaw|Dublin|\bEU\b|\bUK\b|\bGB(?:R)?\b|\bDE(?:U)?\b|\bFR(?:A)?\b|\bNL(?:D)?\b)/i
  ];

  const PSEUDO_NODE_RE =
    /(?:到期|过期|剩余|流量|套餐|官网|网址|订阅|重置|Expire|Expired|Traffic|Remaining|Website)/i;

  const manualRegionRank = (name) => {
    for (let i = 0; i < MANUAL_REGION_TESTS.length; i += 1) {
      if (MANUAL_REGION_TESTS[i].test(name)) return i;
    }
    return MANUAL_REGION_TESTS.length;
  };

  // QuickJS / Android 兼容：不依赖 Intl.localeCompare 的 locale/numeric 实现
  const naturalCompare = (a, b) => {
    const aa = String(a).toLowerCase().match(/\d+|\D+/g) || [String(a).toLowerCase()];
    const bb = String(b).toLowerCase().match(/\d+|\D+/g) || [String(b).toLowerCase()];
    const len = Math.min(aa.length, bb.length);

    for (let i = 0; i < len; i += 1) {
      const x = aa[i];
      const y = bb[i];
      const xn = /^\d+$/.test(x);
      const yn = /^\d+$/.test(y);

      if (xn && yn) {
        const diff = Number(x) - Number(y);
        if (diff !== 0) return diff;
      } else if (x !== y) {
        return x < y ? -1 : 1;
      }
    }

    return aa.length - bb.length;
  };

  const manualProxyNames = Array.isArray(config.proxies)
    ? config.proxies
        .map((proxy) => proxy && proxy.name)
        .filter(
          (name) =>
            typeof name === "string" &&
            name.length > 0 &&
            !PSEUDO_NODE_RE.test(name)
        )
        .sort((a, b) => {
          const rankDiff = manualRegionRank(a) - manualRegionRank(b);
          return rankDiff !== 0 ? rankDiff : naturalCompare(a, b);
        })
    : [];

  // Bettbox / Android：
  // - 常见“扁平 proxies”订阅继续使用脚本排序，保持 全球手动 的地区顺序；
  // - 若订阅使用 proxy-providers，则改由 Mihomo 运行时 include-all 动态纳入，
  //   避免订阅更新后 provider 节点丢失。provider 模式下节点的最终展示顺序由内核决定。
  const hasProxyProviders = providerCount > 0;

  // ---------- 3. 工具函数 ----------
  const select = (name, icon, proxies) => ({
    name,
    type: "select",
    icon,
    proxies
  });

  const region = (name, icon, filter) => ({
    name,
    type: "url-test",
    icon,
    "include-all": true,
    filter,
    "exclude-filter": EXCLUDE,
    url: TEST_URL,
    interval: INTERVAL,
    tolerance: 80,
    lazy: true
  });

  const DOMAIN_BASE =
    "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/";

  const IP_BASE =
    "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geoip/";

  const domainProvider = (file) => ({
    type: "http",
    behavior: "domain",
    format: "mrs",
    path: `./ruleset/skull/${file}`,
    url: DOMAIN_BASE + file,
    interval: RULE_INTERVAL
  });

  const ipProvider = (file) => ({
    type: "http",
    behavior: "ipcidr",
    format: "mrs",
    path: `./ruleset/skull/ip-${file}`,
    url: IP_BASE + file,
    interval: RULE_INTERVAL
  });

  // ---------- 4. 策略组 ----------
  const REGION_GROUPS = [
    "🇭🇰 香港",
    "🇲🇴 澳门",
    "🇹🇼 台湾",
    "🇰🇷 韩国",
    "🇸🇬 新加坡",
    "🇯🇵 日本",
    "🇺🇸 美国",
    "🇪🇺 欧洲",
    "其他地区"
  ];

  const FOREIGN_OPTIONS = [
    "默认代理",
    "自动选择",
    "全球手动",
    ...REGION_GROUPS,
    "DIRECT"
  ];

  const SERVICE_OPTIONS = [
    "国外流量",
    "默认代理",
    "自动选择",
    "全球手动",
    ...REGION_GROUPS,
    "DIRECT"
  ];

  config["proxy-groups"] = [
    // 1. 基础策略
    {
      name: "全球手动",
      type: "select",
      icon: ICON.manual,

      ...(hasProxyProviders
        ? {
            "include-all": true,
            "exclude-filter": EXCLUDE,
            proxies: ["DIRECT"]
          }
        : manualProxyNames.length > 0
          ? {
              proxies: [...manualProxyNames, "DIRECT"]
            }
          : {
              "include-all": true,
              "exclude-filter": EXCLUDE,
              proxies: ["DIRECT"]
            })
    },

    select("默认代理", ICON.default, [
      "自动选择",
      "全球手动",
      ...REGION_GROUPS,
      "DIRECT"
    ]),

    {
      name: "自动选择",
      type: "url-test",
      icon: ICON.auto,
      "include-all": true,
      "exclude-filter": EXCLUDE,
      url: TEST_URL,
      interval: INTERVAL,
      tolerance: 80,
      lazy: true
    },

    select("国内直连", ICON.direct, [
      "DIRECT",
      "默认代理",
      "全球手动"
    ]),

    select("国外流量", ICON.foreign, FOREIGN_OPTIONS),

    select("漏网之鱼", ICON.final, [
      "国外流量",
      "默认代理",
      "全球手动",
      "DIRECT"
    ]),

    // 2. AI
    select("ChatGPT", ICON.chatgpt, SERVICE_OPTIONS),
    select("Claude", ICON.claude, SERVICE_OPTIONS),
    select("Gemini / NotebookLM", ICON.gemini, SERVICE_OPTIONS),

    // 3. 常用国际服务
    select("Google", ICON.google, SERVICE_OPTIONS),
    select("GitHub", ICON.github, SERVICE_OPTIONS),
    select("Microsoft", ICON.microsoft, SERVICE_OPTIONS),
    select("Apple", ICON.apple, SERVICE_OPTIONS),
    select("Telegram", ICON.telegram, SERVICE_OPTIONS),
    select("X", ICON.x, SERVICE_OPTIONS),
    select("YouTube", ICON.youtube, SERVICE_OPTIONS),
    select("Netflix", ICON.netflix, SERVICE_OPTIONS),

    // 4. 地区节点
    region("🇭🇰 香港", ICON.hk, FILTER.hk),
    region("🇲🇴 澳门", ICON.mo, FILTER.mo),
    region("🇹🇼 台湾", ICON.tw, FILTER.tw),
    region("🇰🇷 韩国", ICON.kr, FILTER.kr),
    region("🇸🇬 新加坡", ICON.sg, FILTER.sg),
    region("🇯🇵 日本", ICON.jp, FILTER.jp),
    region("🇺🇸 美国", ICON.us, FILTER.us),
    region("🇪🇺 欧洲", ICON.eu, FILTER.eu),

    {
      name: "其他地区",
      type: "url-test",
      icon: ICON.other,
      "include-all": true,
      filter: "(?i)^.*$",
      "exclude-filter": OTHER_EXCLUDE,
      url: TEST_URL,
      interval: INTERVAL,
      tolerance: 80,
      lazy: true
    }
  ];

  // Bettbox 可视化开关联动：
  // 关闭某个服务组后移除该组，并将规则目标回退至“国外流量”；
  // 关闭“地区分组”后移除全部地区组，同时清理其他策略组中的引用。
  const optionalServiceGroups = [
    "ChatGPT",
    "Claude",
    "Gemini / NotebookLM",
    "Google",
    "GitHub",
    "Microsoft",
    "Apple",
    "Telegram",
    "X",
    "YouTube",
    "Netflix"
  ];

  const disabledGroupNames = {};

  for (let i = 0; i < optionalServiceGroups.length; i += 1) {
    const name = optionalServiceGroups[i];
    if (!featureEnabled(name)) disabledGroupNames[name] = true;
  }

  if (!featureEnabled("地区分组")) {
    for (let i = 0; i < REGION_GROUPS.length; i += 1) {
      disabledGroupNames[REGION_GROUPS[i]] = true;
    }
  }

  config["proxy-groups"] = config["proxy-groups"]
    .filter((group) => !disabledGroupNames[group.name])
    .map((group) => {
      if (Array.isArray(group.proxies)) {
        group.proxies = group.proxies.filter(
          (name) => !disabledGroupNames[name]
        );
      }
      return group;
    });

  // ---------- 5. Rule Providers ----------
  const customRuleProviders = {
    SKULL_Lan: domainProvider("private.mrs"),
    SKULL_China: domainProvider("cn.mrs"),

    SKULL_OpenAI: domainProvider("openai.mrs"),
    SKULL_Claude: domainProvider("anthropic.mrs"),
    SKULL_Gemini: domainProvider("google-gemini.mrs"),

    SKULL_Google: domainProvider("google.mrs"),
    SKULL_GitHub: domainProvider("github.mrs"),
    SKULL_Microsoft: domainProvider("microsoft.mrs"),
    SKULL_AppleCN: domainProvider("apple@cn.mrs"),
    SKULL_Apple: domainProvider("apple.mrs"),
    SKULL_Telegram: domainProvider("telegram.mrs"),
    SKULL_X: domainProvider("x.mrs"),
    SKULL_YouTube: domainProvider("youtube.mrs"),
    SKULL_Netflix: domainProvider("netflix.mrs"),

    SKULL_LanIP: ipProvider("private.mrs"),
    SKULL_ChinaIP: ipProvider("cn.mrs"),
    SKULL_GoogleIP: ipProvider("google.mrs"),
    SKULL_TelegramIP: ipProvider("telegram.mrs"),
    SKULL_XIP: ipProvider("twitter.mrs"),
    SKULL_NetflixIP: ipProvider("netflix.mrs")
  };

  config["rule-providers"] = {
    ...(config["rule-providers"] || {}),
    ...customRuleProviders
  };

  // ---------- 6. 分流规则 ----------
  // NotebookLM / Gemini 必须早于通用 Google
  config.rules = [
    // LAN
    "RULE-SET,SKULL_Lan,国内直连",

    // AI
    `DOMAIN-SUFFIX,notebooklm.google,${serviceTarget("Gemini / NotebookLM")}`,
    `DOMAIN-SUFFIX,notebooklm.google.com,${serviceTarget("Gemini / NotebookLM")}`,
    `DOMAIN-SUFFIX,aistudio.google.com,${serviceTarget("Gemini / NotebookLM")}`,
    `DOMAIN-SUFFIX,ai.google.dev,${serviceTarget("Gemini / NotebookLM")}`,
    `DOMAIN-SUFFIX,generativelanguage.googleapis.com,${serviceTarget("Gemini / NotebookLM")}`,

    `RULE-SET,SKULL_OpenAI,${serviceTarget("ChatGPT")}`,
    `RULE-SET,SKULL_Claude,${serviceTarget("Claude")}`,
    `RULE-SET,SKULL_Gemini,${serviceTarget("Gemini / NotebookLM")}`,

    // 中国区 Apple 直连
    "RULE-SET,SKULL_AppleCN,国内直连",

    // 中国大陆域名
    "RULE-SET,SKULL_China,国内直连",

    // 国际服务
    `RULE-SET,SKULL_YouTube,${serviceTarget("YouTube")}`,
    `RULE-SET,SKULL_Google,${serviceTarget("Google")}`,
    `RULE-SET,SKULL_GitHub,${serviceTarget("GitHub")}`,
    `RULE-SET,SKULL_Microsoft,${serviceTarget("Microsoft")}`,
    `RULE-SET,SKULL_Apple,${serviceTarget("Apple")}`,
    `RULE-SET,SKULL_Telegram,${serviceTarget("Telegram")}`,
    `RULE-SET,SKULL_X,${serviceTarget("X")}`,
    `RULE-SET,SKULL_Netflix,${serviceTarget("Netflix")}`,

    // IP 规则
    "RULE-SET,SKULL_LanIP,国内直连,no-resolve",
    `RULE-SET,SKULL_GoogleIP,${serviceTarget("Google")},no-resolve`,
    `RULE-SET,SKULL_TelegramIP,${serviceTarget("Telegram")},no-resolve`,
    `RULE-SET,SKULL_XIP,${serviceTarget("X")},no-resolve`,
    `RULE-SET,SKULL_NetflixIP,${serviceTarget("Netflix")},no-resolve`,
    "RULE-SET,SKULL_ChinaIP,国内直连,no-resolve",

    // 最终
    "MATCH,漏网之鱼"
  ];

  // ---------- 7. DNS ----------
  config.dns = {
    ...(config.dns || {}),

    enable: true,
    ipv6: false,
    "prefer-h3": false,
    "respect-rules": true,

    "enhanced-mode": "fake-ip",
    "fake-ip-range": "198.18.0.1/16",

    "fake-ip-filter": [
      ...(config.dns && Array.isArray(config.dns["fake-ip-filter"])
        ? config.dns["fake-ip-filter"]
        : []),

      "*.lan",
      "*.local",
      "localhost.ptlogin2.qq.com",
      "time.*.com",
      "time.*.gov",
      "time.*.edu.cn",
      "ntp.*.com"
    ],

    "default-nameserver": [
      "223.5.5.5",
      "119.29.29.29"
    ],

    nameserver: [
      "https://dns.cloudflare.com/dns-query",
      "https://dns.google/dns-query"
    ],

    "nameserver-policy": {
      "RULE-SET:SKULL_China,SKULL_Lan": [
        "https://dns.alidns.com/dns-query",
        "https://doh.pub/dns-query"
      ]
    },

    "proxy-server-nameserver": [
      "https://dns.alidns.com/dns-query",
      "https://doh.pub/dns-query"
    ]
  };

  // ---------- 8. Android TUN / VPN ----------
  // Bettbox Android 的 TUN/VPN 生命周期、路由、DNS 劫持由 App 管理。
  // 这里不覆写 config.tun，避免脚本参数与 Android VPN 层互相覆盖。
  // 建议在 Bettbox 中使用 mixed 栈，并由 App 自身控制 TUN 开关。

  // ---------- 9. 常规增强 ----------
  config.mode = "rule";
  config.ipv6 = false;
  config["unified-delay"] = true;
  config["tcp-concurrent"] = true;
  config["find-process-mode"] = "off";

  config.profile = {
    ...(config.profile || {}),
    "store-selected": true,
    "store-fake-ip": true
  };

  return config;
}
