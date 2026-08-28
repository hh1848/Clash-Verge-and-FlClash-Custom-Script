// Clash Verge Rev 全局扩展脚本
// 作用：
// 1. 保留机场原始 proxies / proxy-providers
// 2. 统一生成 Mihomo 策略组、规则与 DNS
// 3. 绝不修改任何机场节点原始名称
//
// 使用位置：订阅 -> 全局扩展脚本（Script）

function main(config, profileName) {
  // ============================================================
  // 基础判断
  // ============================================================

  // 不处理 MihomoProPlus 模板本身
  if (
    typeof profileName === "string" &&
    profileName.indexOf("MihomoProPlus") !== -1
  ) {
    return config;
  }

  const directProxyCount = Array.isArray(config.proxies)
    ? config.proxies.length
    : 0;

  const providers = config["proxy-providers"];

  const providerCount =
    providers && typeof providers === "object"
      ? Object.keys(providers).length
      : 0;

  // 没有节点时不处理
  if (directProxyCount === 0 && providerCount === 0) {
    return config;
  }

  // ============================================================
  // 基础配置
  // ============================================================

  config.mode = "rule";
  config.ipv6 = true;
  config["unified-delay"] = true;
  config["tcp-concurrent"] = true;
  config["find-process-mode"] = "strict";
  config["keep-alive-interval"] = 15;
  config["keep-alive-idle"] = 600;

  // 保留 Clash Verge / 机场原有 TUN 配置，只覆盖必要项目
  const oldTun =
    config.tun && typeof config.tun === "object"
      ? config.tun
      : {};

  config.tun = Object.assign({}, oldTun, {
    stack: "mixed",

    "dns-hijack": [
      "any:53",
      "tcp://any:53"
    ],

    "auto-route": true,
    "auto-redirect": true,
    "auto-detect-interface": true
  });

  config.profile = Object.assign(
    {},
    config.profile || {},
    {
      "store-selected": true,
      "store-fake-ip": true
    }
  );

  // ============================================================
  // 流量嗅探
  // ============================================================

  config.sniffer = {
    enable: true,

    sniff: {
      HTTP: {
        ports: [
          80,
          "8080-8880"
        ],

        "override-destination": true
      },

      TLS: {
        ports: [
          443,
          8443
        ]
      },

      QUIC: {
        ports: [
          443,
          8443
        ]
      }
    },

    "skip-domain": [
      "Mijia Cloud",
      "+.push.apple.com"
    ]
  };

  // ============================================================
  // Hosts
  // ============================================================

  config.hosts = Object.assign(
    {},
    config.hosts || {},
    {
      "services.googleapis.cn": "services.googleapis.com",
      "cn.bing.com": "www4.bing.com"
    }
  );

  // ============================================================
  // DNS
  // ============================================================

  config.dns = {
    enable: true,

    ipv6: true,

    "enhanced-mode": "fake-ip",

    "fake-ip-range": "198.18.0.1/16",

    "fake-ip-filter-mode": "blacklist",

    // 这里只放真正需要避免 Fake-IP 的域名。
    // 不再加入整个 China Rule Set，避免大量国内域名退出 Fake-IP。
    "fake-ip-filter": [
      "+.lan",
      "+.local",

      "time.*.com",
      "ntp.*.com",

      "+.market.xiaomi.com",
      "+.pub.3gppnetwork.org",
      "+.push.apple.com",

      "+.bing.com"
    ],

    "use-hosts": true,

    "respect-rules": true,

    "default-nameserver": [
      "tls://223.5.5.5",
      "tls://223.6.6.6"
    ],

    nameserver: [
      "https://cloudflare-dns.com/dns-query",
      "https://dns.google/dns-query"
    ],

    "direct-nameserver": [
      "https://dns.alidns.com/dns-query",
      "https://doh.pub/dns-query"
    ],

    "proxy-server-nameserver": [
      "https://dns.alidns.com/dns-query",
      "https://doh.pub/dns-query"
    ],

    "nameserver-policy": {
      "rule-set:Advertising,AWAvenueAds":
        "rcode://success",

      "rule-set:Direct,Private,China": [
        "https://dns.alidns.com/dns-query",
        "https://doh.pub/dns-query"
      ],

      "rule-set:Speedtest,Twitter,Telegram,SocialMedia,NewsMedia,Games,Crypto,Emby,Netflix,YouTube,Streaming,Apple,Google,Microsoft,Proxy": [
        "https://dns.google/dns-query",
        "https://cloudflare-dns.com/dns-query"
      ]
    }
  };

  // ============================================================
  // 节点地区识别
  //
  // 注意：
  // 这里只读取 proxy.name。
  // 绝不修改 proxy.name。
  // ============================================================

  const regions = {
    HK: {
      name: "香港",

      filter:
        "(?i)^(?=.*(香港|🇭🇰|\\bHK\\b|Hong\\s*Kong|HKG))(?!.*(排除1|排除2|5x)).*$",

      icon:
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Hong_Kong.png"
    },

    SG: {
      name: "狮城",

      filter:
        "(?i)^(?=.*(新加坡|狮城|獅城|🇸🇬|\\bSG\\b|Singapore|SIN|XSP))(?!.*(排除1|排除2|5x)).*$",

      icon:
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Singapore.png"
    },

    JP: {
      name: "日本",

      filter:
        "(?i)^(?=.*(日本|🇯🇵|\\bJP\\b|Japan|NRT|HND|KIX|CTS|FUK))(?!.*(尼日利亚|排除2|5x)).*$",

      icon:
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Japan.png"
    },

    KR: {
      name: "韩国",

      filter:
        "(?i)^(?=.*(韩国|韓國|首尔|首爾|南朝鲜|南韓|🇰🇷|\\bKR\\b|KOR|Korea))(?!.*(排除1|排除2|5x|Africa)).*$",

      icon:
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Korea.png"
    },

    US: {
      name: "美国",

      filter:
        "(?i)^(?=.*(美国|美國|🇺🇸|\\bUS\\b|USA|United\\s*States|America|JFK|SJC|LAX|ORD|ATL|DFW|SFO|MIA|SEA|IAD))(?!.*(Plus|Australia|5x)).*$",

      icon:
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/United_States.png"
    },

    TW: {
      name: "台湾",

      filter:
        "(?i)^(?=.*(台湾|台灣|🇹🇼|\\bTW\\b|Taiwan|TPE|TSA|KHH))(?!.*(排除1|排除2|5x)).*$",

      icon:
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Taiwan.png"
    },

    EU: {
      name: "欧洲",

      filter:
        "(?i)^(?=.*(奥|奥地利|比|比利时|保|保加利亚|克罗地亚|塞|塞尔维亚|捷|捷克|丹|丹麦|爱沙|爱沙尼亚|芬|芬兰|法|法国|德|德国|希|希腊|匈|匈牙利|爱尔|爱尔兰|意|意大利|拉|拉脱维亚|立|立陶宛|卢|卢森堡|马其他|荷|荷兰|波|波兰|葡|葡萄牙|罗|罗马尼亚|斯洛伐|斯洛伐克|斯洛文|斯洛文尼亚|西|西班牙|瑞|瑞典|英|英国|🇦🇹|🇧🇪|🇨🇿|🇩🇰|🇫🇮|🇫🇷|🇩🇪|🇮🇪|🇮🇹|🇱🇹|🇱🇺|🇳🇱|🇵🇱|🇸🇪|🇬🇧|CDG|FRA|AMS|MAD|BCN|FCO|MUC|BRU|LHR|LGW))(?!.*(排除1|排除2|5x)).*$",

      icon:
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/European_Union.png"
    },

    MO: {
      name: "澳门",

      filter:
        "(?i)^(?=.*(澳门|澳門|濠江|🇲🇴|\\bMO\\b|Macau|Macao|MFM|Taipa|氹仔|路氹|路环|Coloane|Cotai|MOG))(?!.*(排除1|排除2|5x)).*$",

      icon:
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Macao.png"
    }
  };

  // ============================================================
  // 通用节点过滤
  //
  // 只用于过滤节点，不修改节点名称。
  // ============================================================

  const FilterAL =
    "^(?!.*(DIRECT|直接连接|群|邀请|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|特别行政区|访问|支持|教程|关注|更新|作者|加入|USE|USED|TOTAL|EXPIRE|EMAIL|Panel|Channel|Author))";

  const FilterOT =
    "^(?!.*(DIRECT|直接连接|群|邀请|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|访问|支持|教程|关注|更新|作者|加入|美|港|坡|台|新|日|韩|奥|比|保|克罗地亚|塞|捷|丹|爱沙|芬|法|德|希|匈|爱尔|意|拉|立|卢|马其他|荷|波|葡|罗|斯洛伐|斯洛文|西|瑞|英|澳门|澳門|濠江|🇭🇰|🇹🇼|🇸🇬|🇯🇵|🇰🇷|🇺🇸|🇬🇧|🇲🇴|🇦🇹|🇧🇪|🇨🇿|🇩🇰|🇫🇮|🇫🇷|🇩🇪|🇮🇪|🇮🇹|🇱🇹|🇱🇺|🇳🇱|🇵🇱|🇸🇪|\\bHK\\b|\\bTW\\b|\\bSG\\b|\\bJP\\b|\\bKR\\b|\\bUS\\b|\\bGB\\b|\\bMO\\b|CDG|FRA|AMS|MAD|BCN|FCO|MUC|BRU|HKG|TPE|TSA|KHH|SIN|XSP|NRT|HND|KIX|CTS|FUK|JFK|SJC|LAX|ORD|ATL|DFW|SFO|MIA|SEA|IAD|LHR|LGW|MFM|MOG|Taipa|Coloane|Cotai))";

  // ============================================================
  // Icon
  // ============================================================

  const ICON = {
    static:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Static.png",

    clubhouse:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Clubhouse.png",

    ulb:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/ULB.png",

    global:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Global.png",

    china:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/China.png",

    final:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Final.png",

    direct:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Direct.png",

    speedtest:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Speedtest.png",

    location:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Null_Nation.png",

    emby:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Emby.png",

    youtube:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/YouTube.png",

    netflix:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Netflix.png",

    media:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/DomesticMedia.png",

    news:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Apple_News.png",

    telegram:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Telegram_X.png",

    twitter:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/X.png",

    social:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/PBS.png",

    ai:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Bot.png",

    googleAI:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/AI.png",

    crypto:
      "https://raw.githubusercontent.com/Orz-3/mini/master/Alpha/Bitcloud.png",

    game:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Game.png",

    github:
      "https://raw.githubusercontent.com/lige47/QuanX-icon-rule/main/icon/04ProxySoft/github(1).png",

    microsoft:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Microsoft.png",

    google:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Google_Search.png",

    apple:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Apple.png",

    hash:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin_1.png",

    roundRobin:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin.png",

    auto:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Auto.png",

    europe:
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Europe_Map.png",

    ukwifi:
      "https://www.giffgaff.design/iconography/icons/library/coverage-signal.svg"
  };

  // ============================================================
  // 策略组公共列表
  // ============================================================

  const selectFB = [
    "故障转移",
    "香港策略",
    "狮城策略",
    "日本策略",
    "韩国策略",
    "美国策略",
    "台湾策略",
    "澳门策略",
    "欧洲策略",
    "冷门自选",
    "全球手动",
    "直接连接"
  ];

  const selectPY = [
    "默认代理",
    "故障转移",
    "香港策略",
    "狮城策略",
    "日本策略",
    "韩国策略",
    "美国策略",
    "台湾策略",
    "澳门策略",
    "欧洲策略",
    "冷门自选",
    "全球手动",
    "直接连接"
  ];

  const selectDC = [
    "直接连接",
    "默认代理",
    "故障转移",
    "香港策略",
    "狮城策略",
    "日本策略",
    "韩国策略",
    "美国策略",
    "台湾策略",
    "澳门策略",
    "欧洲策略",
    "冷门自选",
    "全球手动"
  ];

  const selectUS = [
    "美国策略",
    "默认代理",
    "故障转移",
    "香港策略",
    "狮城策略",
    "日本策略",
    "韩国策略",
    "台湾策略",
    "澳门策略",
    "欧洲策略",
    "冷门自选",
    "全球手动",
    "直接连接"
  ];

  const selectSG = [
    "狮城策略",
    "默认代理",
    "故障转移",
    "香港策略",
    "日本策略",
    "韩国策略",
    "美国策略",
    "台湾策略",
    "澳门策略",
    "欧洲策略",
    "冷门自选",
    "全球手动",
    "直接连接"
  ];

  // ============================================================
  // 工具函数
  // ============================================================

  function selectGroup(name, proxiesList, icon) {
    return {
      name: name,
      type: "select",
      proxies: proxiesList.slice(),
      icon: icon
    };
  }

  function regionSelect(
    name,
    region,
    autoName,
    hashName,
    rrName
  ) {
    return {
      name: name,

      type: "select",

      proxies: [
        autoName,
        hashName,
        rrName
      ],

      // 同时包含：
      // 1. config.proxies
      // 2. proxy-providers
      "include-all": true,

      filter: region.filter,

      "empty-fallback": "COMPATIBLE",

      icon: region.icon
    };
  }

  function urlTest(name, filter) {
    return {
      name: name,

      type: "url-test",

      // 5 分钟测速一次
      interval: 300,

      lazy: true,

      url:
        "https://www.google.com/generate_204",

      hidden: true,

      "include-all": true,

      filter: filter,

      "empty-fallback": "COMPATIBLE",

      icon: ICON.auto
    };
  }

  function loadBalance(
    name,
    filter,
    strategy
  ) {
    return {
      name: name,

      type: "load-balance",

      // 5 分钟更新一次
      interval: 300,

      lazy: true,

      url:
        "https://www.google.com/generate_204",

      strategy: strategy,

      hidden: true,

      "include-all": true,

      filter: filter,

      "empty-fallback": "COMPATIBLE",

      icon:
        strategy === "consistent-hashing"
          ? ICON.hash
          : ICON.roundRobin
    };
  }

  // ============================================================
  // 全球手动节点排序
  //
  // 重要：
  // 这里只改变“全球手动”策略组中的显示顺序。
  // 不修改任何 proxy 对象。
  // 不修改任何节点 name。
  //
  // 注意：
  // proxy-providers 的远程节点由 Mihomo 动态管理，
  // JS 无法直接读取 provider 下载后的节点列表，
  // 因此 provider 节点保持 provider 自身顺序。
  // ============================================================

  function getGlobalManualProxies() {
    if (!Array.isArray(config.proxies)) {
      return [];
    }

    const excludeRegex =
      /(群|邀请|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|访问|支持|教程|关注|更新|作者|加入|USE|USED|TOTAL|EXPIRE|EMAIL|Panel|Channel|Author)/i;

    function getPriority(name) {
      // 香港
      if (
        /(香港|🇭🇰|\bHK\b|Hong\s*Kong|HKG)/i.test(name)
      ) {
        return 10;
      }

      // 澳门
      if (
        /(澳门|澳門|濠江|🇲🇴|\bMO\b|Macau|Macao|MFM|Taipa|氹仔|路氹|路环|Coloane|Cotai|MOG)/i.test(name)
      ) {
        return 15;
      }

      // 台湾
      if (
        /(台湾|台灣|🇹🇼|\bTW\b|Taiwan|TPE|TSA|KHH)/i.test(name)
      ) {
        return 20;
      }

      // 新加坡
      if (
        /(新加坡|狮城|獅城|🇸🇬|\bSG\b|Singapore|SIN|XSP)/i.test(name)
      ) {
        return 30;
      }

      // 日本
      if (
        /(日本|🇯🇵|\bJP\b|Japan|NRT|HND|KIX|CTS|FUK)/i.test(name)
      ) {
        return 40;
      }

      // 韩国
      if (
        /(韩国|韓國|首尔|首爾|🇰🇷|\bKR\b|Korea|KOR)/i.test(name)
      ) {
        return 50;
      }

      // 美国
      if (
        /(美国|美國|🇺🇸|\bUS\b|USA|United\s*States|America|LAX|SFO|JFK|SJC|SEA|IAD|ORD|ATL|DFW|MIA)/i.test(name)
      ) {
        return 60;
      }

      // 英国
      if (
        /(英国|英國|🇬🇧|\bUK\b|\bGB\b|United\s*Kingdom|London|LHR|LGW)/i.test(name)
      ) {
        return 70;
      }

      // 德国
      if (
        /(德国|德國|\bDE\b|Germany|Frankfurt|FRA|MUC)/i.test(name)
      ) {
        return 80;
      }

      // 法国
      if (
        /(法国|法國|\bFR\b|France|Paris|CDG)/i.test(name)
      ) {
        return 90;
      }

      // 其他节点
      return 1000;
    }

    return config.proxies
      .map(function (proxy, index) {
        return {
          name: proxy && proxy.name,
          index: index
        };
      })

      // 只过滤，不修改名称
      .filter(function (item) {
        return (
          item.name &&
          !excludeRegex.test(item.name)
        );
      })

      .sort(function (a, b) {
        const priorityDiff =
          getPriority(a.name) -
          getPriority(b.name);

        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        // 同地区保持机场原始顺序
        return a.index - b.index;
      })

      .map(function (item) {
        return item.name;
      });
  }

  const globalManualProxies =
    getGlobalManualProxies();

  // Provider 名称保持原样
  const globalManualProviders =
    config["proxy-providers"] &&
    typeof config["proxy-providers"] === "object"
      ? Object.keys(config["proxy-providers"])
      : [];

  // ============================================================
  // 代理组
  // ============================================================

  const proxyGroups = [
    // ==========================================================
    // 全球手动
    // ==========================================================

    {
      name: "全球手动",

      type: "select",

      // 这里只是策略组中的排列顺序。
      // 不会修改节点自身名称。
      proxies: globalManualProxies,

      // Provider 原名称保持不变
      use: globalManualProviders,

      filter: FilterAL,

      "empty-fallback": "COMPATIBLE",

      icon: ICON.clubhouse
    },

    // ==========================================================
    // 主要策略组
    // ==========================================================

    selectGroup(
      "默认代理",
      selectFB,
      ICON.static
    ),

    {
      name: "故障转移",

      type: "fallback",

      interval: 300,

      lazy: true,

      url:
        "https://www.google.com/generate_204",

      proxies: [
        "香港策略",
        "狮城策略",
        "日本策略",
        "韩国策略",
        "美国策略",
        "台湾策略",
        "澳门策略",
        "欧洲策略",
        "全球手动",
        "冷门自选",
        "直接连接"
      ],

      icon: ICON.ulb
    },

    selectGroup(
      "国外流量",
      selectPY,
      ICON.global
    ),

    selectGroup(
      "国内流量",
      selectDC,
      ICON.china
    ),

    selectGroup(
      "兜底流量",
      selectPY,
      ICON.final
    ),

    {
      name: "直接连接",

      type: "select",

      proxies: [
        "DIRECT"
      ],

      hidden: true,

      icon: ICON.direct
    },

    // ==========================================================
    // 功能策略组
    // ==========================================================

    {
      name: "网络测试",

      type: "select",

      proxies: selectPY.slice(),

      "include-all": true,

      filter: FilterAL,

      "empty-fallback": "COMPATIBLE",

      icon: ICON.speedtest
    },

    {
      name: "UKwifi",

      type: "select",

      proxies: [
        "DIRECT",
        "欧洲策略"
      ],

      icon: ICON.ukwifi
    },

    {
      name: "抖快书定位",

      type: "select",

      proxies: [
        "直接连接",
        "香港策略",
        "台湾策略",
        "狮城策略",
        "日本策略",
        "韩国策略",
        "美国策略",
        "欧洲策略"
      ],

      icon: ICON.location
    },

    // ==========================================================
    // 媒体
    // ==========================================================

    selectGroup(
      "Emby服",
      selectPY,
      ICON.emby
    ),

    selectGroup(
      "油管视频",
      selectPY,
      ICON.youtube
    ),

    selectGroup(
      "奈飞视频",
      selectPY,
      ICON.netflix
    ),

    selectGroup(
      "国际媒体",
      selectPY,
      ICON.media
    ),

    selectGroup(
      "新闻媒体",
      selectUS,
      ICON.news
    ),

    // ==========================================================
    // 社交
    // ==========================================================

    selectGroup(
      "电报消息",
      selectPY,
      ICON.telegram
    ),

    selectGroup(
      "推特社交",
      selectPY,
      ICON.twitter
    ),

    selectGroup(
      "社交平台",
      selectPY,
      ICON.social
    ),

    // ==========================================================
    // 服务
    // ==========================================================

    selectGroup(
      "人工智能",
      selectUS,
      ICON.ai
    ),

    selectGroup(
      "谷歌AI",
      selectUS,
      ICON.googleAI
    ),

    selectGroup(
      "货币平台",
      selectSG,
      ICON.crypto
    ),

    selectGroup(
      "游戏平台",
      selectPY,
      ICON.game
    ),

    selectGroup(
      "Github",
      selectPY,
      ICON.github
    ),

    selectGroup(
      "微软服务",
      selectPY,
      ICON.microsoft
    ),

    selectGroup(
      "谷歌服务",
      selectPY,
      ICON.google
    ),

    selectGroup(
      "苹果服务",
      selectPY,
      ICON.apple
    ),

    // ==========================================================
    // 地区策略
    // ==========================================================

    regionSelect(
      "香港策略",
      regions.HK,
      "香港自动",
      "香港均衡-散列",
      "香港均衡-轮询"
    ),

    regionSelect(
      "台湾策略",
      regions.TW,
      "台湾自动",
      "台湾均衡-散列",
      "台湾均衡-轮询"
    ),

    regionSelect(
      "狮城策略",
      regions.SG,
      "狮城自动",
      "狮城均衡-散列",
      "狮城均衡-轮询"
    ),

    regionSelect(
      "日本策略",
      regions.JP,
      "日本自动",
      "日本均衡-散列",
      "日本均衡-轮询"
    ),

    regionSelect(
      "韩国策略",
      regions.KR,
      "韩国自动",
      "韩国均衡-散列",
      "韩国均衡-轮询"
    ),

    regionSelect(
      "美国策略",
      regions.US,
      "美国自动",
      "美国均衡-散列",
      "美国均衡-轮询"
    ),

    regionSelect(
      "欧洲策略",
      regions.EU,
      "欧洲自动",
      "欧洲均衡-散列",
      "欧洲均衡-轮询"
    ),

    regionSelect(
      "澳门策略",
      regions.MO,
      "澳门自动",
      "澳门均衡-散列",
      "澳门均衡-轮询"
    ),

    // ==========================================================
    // 其他节点
    // ==========================================================

    {
      name: "冷门自选",

      type: "select",

      "include-all": true,

      filter: FilterOT,

      "empty-fallback": "COMPATIBLE",

      icon: ICON.europe
    },

    // ==========================================================
    // 自动测速
    // ==========================================================

    urlTest(
      "香港自动",
      regions.HK.filter
    ),

    urlTest(
      "台湾自动",
      regions.TW.filter
    ),

    urlTest(
      "狮城自动",
      regions.SG.filter
    ),

    urlTest(
      "日本自动",
      regions.JP.filter
    ),

    urlTest(
      "韩国自动",
      regions.KR.filter
    ),

    urlTest(
      "美国自动",
      regions.US.filter
    ),

    urlTest(
      "欧洲自动",
      regions.EU.filter
    ),

    urlTest(
      "澳门自动",
      regions.MO.filter
    ),

    // ==========================================================
    // 散列负载均衡
    // ==========================================================

    loadBalance(
      "香港均衡-散列",
      regions.HK.filter,
      "consistent-hashing"
    ),

    loadBalance(
      "台湾均衡-散列",
      regions.TW.filter,
      "consistent-hashing"
    ),

    loadBalance(
      "狮城均衡-散列",
      regions.SG.filter,
      "consistent-hashing"
    ),

    loadBalance(
      "日本均衡-散列",
      regions.JP.filter,
      "consistent-hashing"
    ),

    loadBalance(
      "韩国均衡-散列",
      regions.KR.filter,
      "consistent-hashing"
    ),

    loadBalance(
      "美国均衡-散列",
      regions.US.filter,
      "consistent-hashing"
    ),

    loadBalance(
      "欧洲均衡-散列",
      regions.EU.filter,
      "consistent-hashing"
    ),

    loadBalance(
      "澳门均衡-散列",
      regions.MO.filter,
      "consistent-hashing"
    ),

    // ==========================================================
    // 轮询负载均衡
    // ==========================================================

    loadBalance(
      "香港均衡-轮询",
      regions.HK.filter,
      "round-robin"
    ),

    loadBalance(
      "台湾均衡-轮询",
      regions.TW.filter,
      "round-robin"
    ),

    loadBalance(
      "狮城均衡-轮询",
      regions.SG.filter,
      "round-robin"
    ),

    loadBalance(
      "日本均衡-轮询",
      regions.JP.filter,
      "round-robin"
    ),

    loadBalance(
      "韩国均衡-轮询",
      regions.KR.filter,
      "round-robin"
    ),

    loadBalance(
      "美国均衡-轮询",
      regions.US.filter,
      "round-robin"
    ),

    loadBalance(
      "欧洲均衡-轮询",
      regions.EU.filter,
      "round-robin"
    ),

    loadBalance(
      "澳门均衡-轮询",
      regions.MO.filter,
      "round-robin"
    )
  ];

  config["proxy-groups"] = proxyGroups;

  // ============================================================
  // 分流规则
  // ============================================================

  config.rules = [
    // ----------------------------------------------------------
    // 广告与跟踪
    // ----------------------------------------------------------

    "RULE-SET,Tracking,REJECT",
    "RULE-SET,AWAvenueAds,REJECT",
    "RULE-SET,Advertising,REJECT",

    // ----------------------------------------------------------
    // 国内 / 特殊直连
    // ----------------------------------------------------------

    "RULE-SET,ukwifi,UKwifi",

    "RULE-SET,LocationDKS,抖快书定位",

    "RULE-SET,Private,直接连接",

    "RULE-SET,Direct,直接连接",

    "RULE-SET,XPTV,直接连接",

    "RULE-SET,Download,直接连接",

    "RULE-SET,AppleCN,直接连接",

    // ----------------------------------------------------------
    // Google Gemini / AI
    // ----------------------------------------------------------

    // NotebookLM
    "DOMAIN-SUFFIX,notebooklm.google,谷歌AI",
    "DOMAIN-SUFFIX,notebooklm.google.com,谷歌AI",
    "DOMAIN-SUFFIX,notebook.google.com,谷歌AI",

    // Gemini
    "DOMAIN-SUFFIX,gemini.google.com,谷歌AI",

    // Bard 历史域名
    "DOMAIN-SUFFIX,bard.google.com,谷歌AI",

    // Google AI Studio / MakerSuite
    "DOMAIN-SUFFIX,aistudio.google.com,谷歌AI",
    "DOMAIN-SUFFIX,makersuite.google.com,谷歌AI",

    // Gemini API
    "DOMAIN-SUFFIX,generativelanguage.googleapis.com,谷歌AI",
    "DOMAIN-SUFFIX,ai.google.dev,谷歌AI",

    // Google Labs
    "DOMAIN-SUFFIX,labs.google,谷歌AI",
    "DOMAIN-SUFFIX,labs.google.com,谷歌AI",

    // Google DeepMind
    "DOMAIN-SUFFIX,deepmind.google,谷歌AI",
    "DOMAIN-SUFFIX,deepmind.google.com,谷歌AI",

    // Google AI 品牌域
    "DOMAIN-SUFFIX,google.ai,谷歌AI",

    // 其他 AI
    "RULE-SET,AI,人工智能",

    // ----------------------------------------------------------
    // 测速
    // ----------------------------------------------------------

    "DOMAIN-KEYWORD,speedtest,网络测试",
    "RULE-SET,Speedtest,网络测试",

    // ----------------------------------------------------------
    // 社交
    // ----------------------------------------------------------

    "RULE-SET,Twitter,推特社交",

    "RULE-SET,Telegram,电报消息",

    "RULE-SET,SocialMedia,社交平台",

    "RULE-SET,NewsMedia,新闻媒体",

    // ----------------------------------------------------------
    // 特殊直连
    // ----------------------------------------------------------

    "DOMAIN-SUFFIX,steamserver.net,直接连接",

    // ----------------------------------------------------------
    // 游戏 / 加密货币
    // ----------------------------------------------------------

    "RULE-SET,Games,游戏平台",

    "RULE-SET,Crypto,货币平台",

    // ----------------------------------------------------------
    // 媒体
    // ----------------------------------------------------------

    "RULE-SET,Emby,Emby服",

    "RULE-SET,Netflix,奈飞视频",

    "RULE-SET,YouTube,油管视频",

    "RULE-SET,Streaming,国际媒体",

    // ----------------------------------------------------------
    // Google / Apple / GitHub / Microsoft
    // ----------------------------------------------------------

    "RULE-SET,Apple,苹果服务",

    "RULE-SET,Google,谷歌服务",

    "RULE-SET,github,Github",

    "RULE-SET,Microsoft,微软服务",

    // ----------------------------------------------------------
    // IP 规则
    // ----------------------------------------------------------

    "RULE-SET,AdvertisingIP,REJECT,no-resolve",

    "RULE-SET,PrivateIP,直接连接,no-resolve",

    "RULE-SET,XPTVIP,直接连接,no-resolve",

    "RULE-SET,AIIP,人工智能,no-resolve",

    "RULE-SET,TelegramIP,电报消息,no-resolve",

    "RULE-SET,SocialMediaIP,社交平台,no-resolve",

    "RULE-SET,EmbyIP,Emby服,no-resolve",

    "RULE-SET,NetflixIP,奈飞视频,no-resolve",

    "RULE-SET,StreamingIP,国际媒体,no-resolve",

    "RULE-SET,GoogleIP,谷歌服务,no-resolve",

    "RULE-SET,ProxyIP,国外流量,no-resolve",

    "RULE-SET,ChinaIP,国内流量,no-resolve",

    // ----------------------------------------------------------
    // 最终兜底
    // ----------------------------------------------------------

    "MATCH,兜底流量"
  ];

  // ============================================================
  // Rule Providers
  // ============================================================

  function domainMRS(url) {
    return {
      type: "http",
      behavior: "domain",
      format: "mrs",
      interval: 86400,
      url: url
    };
  }

  function domainYAML(url) {
    return {
      type: "http",
      behavior: "domain",
      format: "yaml",
      interval: 86400,
      url: url
    };
  }

  function ipMRS(url) {
    return {
      type: "http",
      behavior: "ipcidr",
      format: "mrs",
      interval: 86400,
      url: url
    };
  }

  config["rule-providers"] = {
    // ==========================================================
    // Domain
    // ==========================================================

    Tracking: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Tracking.mrs"
    ),

    Advertising: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Advertising.mrs"
    ),

    Direct: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Direct.mrs"
    ),

    LocationDKS: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/LocationDKS.mrs"
    ),

    Private: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Private.mrs"
    ),

    Download: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Download.mrs"
    ),

    Speedtest: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Speedtest.mrs"
    ),

    AI: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/AI.mrs"
    ),

    Telegram: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Telegram.mrs"
    ),

    Twitter: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Twitter.mrs"
    ),

    SocialMedia: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/SocialMedia.mrs"
    ),

    NewsMedia: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/NewsMedia.mrs"
    ),

    Games: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Games.mrs"
    ),

    Crypto: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Crypto.mrs"
    ),

    Netflix: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Netflix.mrs"
    ),

    YouTube: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/YouTube.mrs"
    ),

    XPTV: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/XPTV.mrs"
    ),

    Emby: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Emby.mrs"
    ),

    Streaming: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Streaming.mrs"
    ),

    AppleCN: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/AppleCN.mrs"
    ),

    Apple: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Apple.mrs"
    ),

    Google: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Google.mrs"
    ),

    Microsoft: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Microsoft.mrs"
    ),

    Proxy: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/Proxy.mrs"
    ),

    China: domainMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/domain/China.mrs"
    ),

    // ==========================================================
    // IP
    // ==========================================================

    AdvertisingIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/Advertising.mrs"
    ),

    PrivateIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/Private.mrs"
    ),

    AIIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/AI.mrs"
    ),

    TelegramIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/Telegram.mrs"
    ),

    SocialMediaIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/SocialMedia.mrs"
    ),

    XPTVIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/XPTV.mrs"
    ),

    EmbyIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/Emby.mrs"
    ),

    NetflixIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/Netflix.mrs"
    ),

    StreamingIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/Streaming.mrs"
    ),

    GoogleIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/Google.mrs"
    ),

    ProxyIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/Proxy.mrs"
    ),

    ChinaIP: ipMRS(
      "https://github.com/666OS/rules/raw/release/mihomo/ip/China.mrs"
    ),

    // ==========================================================
    // WiFi Calling
    // ==========================================================

    ukwifi: {
      type: "http",

      behavior: "classical",

      format: "text",

      interval: 86400,

      url:
        "https://raw.githubusercontent.com/HenryChiao/wificalling/refs/heads/main/qiao/wificalling.list"
    },

    // ==========================================================
    // 广告
    // ==========================================================

    AWAvenueAds: domainYAML(
      "https://raw.githubusercontent.com/TG-Twilight/AWAvenue-Ads-Rule/main/Filters/AWAvenue-Ads-Rule-Clash.yaml"
    ),

    // ==========================================================
    // GitHub
    // ==========================================================

    github: {
      type: "http",

      behavior: "classical",

      format: "yaml",

      interval: 3600,

      proxy: "DIRECT",

      url:
        "https://rule.kelee.one/Clash/GitHub.yaml"
    }
  };

  // ============================================================
  // 返回配置
  // ============================================================

  return config;
}
