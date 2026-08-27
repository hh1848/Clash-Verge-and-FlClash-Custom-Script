// FlClash Android 覆写脚本
// 基于 MihomoProPlus 全局脚本整理
// 保留机场原始 proxies / proxy-providers，统一代理组、规则、DNS。
// “全球手动”保持第一位，并按：香港→台湾→新加坡→日本→韩国→美国→英国→德国→法国→其他 排序。

function main(config) {
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

  // ==================== 基础配置 ====================

  config.mode = "rule";
  config.ipv6 = true;
  config["unified-delay"] = true;
  config["tcp-concurrent"] = true;
  config["find-process-mode"] = "always";
  config["keep-alive-interval"] = 15;
  config["keep-alive-idle"] = 600;

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

  config.experimental = Object.assign(
    {},
    config.experimental || {},
    {
      "quic-go-disable-gso": true
    }
  );

  config.profile = Object.assign(
    {},
    config.profile || {},
    {
      "store-selected": true,
      "store-fake-ip": true
    }
  );

  // ==================== 流量嗅探 ====================

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

  // ==================== Hosts ====================

  config.hosts = Object.assign(
    {},
    config.hosts || {},
    {
      "miwifi.com": "192.168.31.2",

      "epdg.epc.mnc010.mcc234.pub.3gppnetwork.org": [
        "87.194.8.8",
        "87.194.88.8",
        "87.194.89.8",
        "87.194.9.8"
      ],

      "services.googleapis.cn": "services.googleapis.com",

      "cn.bing.com": "www4.bing.com"
    }
  );

  // ==================== DNS ====================

  config.dns = {
    enable: true,

    ipv6: true,

    "enhanced-mode": "fake-ip",

    "fake-ip-range": "198.18.0.1/16",

    "fake-ip-filter": [
      "+.lan",
      "+.local",

      "time.*.com",
      "ntp.*.com",

      "+.market.xiaomi.com",
      "+.pub.3gppnetwork.org",
      "+.push.apple.com",
      "+.bing.com",

      "rule-set:Direct",
      "rule-set:Private",
      "rule-set:China"
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

  // ==================== 节点筛选 ====================

  const FilterHK =
    "(?i)^(?=.*(港|🇭🇰|HK|Hong|HKG))(?!.*(排除1|排除2|5x)).*$";

  const FilterSG =
    "(?i)^(?=.*(坡|🇸🇬|SG|Sing|SIN|XSP))(?!.*(排除1|排除2|5x)).*$";

  const FilterJP =
    "(?i)^(?=.*(日|🇯🇵|JP|Japan|NRT|HND|KIX|CTS|FUK))(?!.*(尼日利亚|排除2|5x)).*$";

  const FilterKR =
    "(?i)^(?=.*(韩|🇰🇷|韓|首尔|南朝鲜|KR|KOR|Korea))(?!.*(排除1|排除2|5x)).*$";

  const FilterUS =
    "(?i)^(?=.*(美|🇺🇸|(?<![A-Za-z])US(?![A-Za-z])|USA|JFK|SJC|LAX|ORD|ATL|DFW|SFO|MIA|SEA|IAD))(?!.*(Plus|Australia|5x)).*$";

  const FilterTW =
    "(?i)^(?=.*(台|🇹🇼|TW|tai|TPE|TSA|KHH))(?!.*(排除1|排除2|5x)).*$";

  const FilterEU =
    "(?i)^(?=.*(奥地利|比利时|保加利亚|克罗地亚|塞浦路斯|塞尔维亚|捷克|丹麦|爱沙尼亚|芬兰|法国|德国|希腊|匈牙利|爱尔兰|意大利|拉脱维亚|立陶宛|卢森堡|马其顿|荷兰|波兰|葡萄牙|罗马尼亚|斯洛伐克|斯洛文尼亚|西班牙|瑞典|瑞士|英国|🇦🇹|🇧🇪|🇨🇿|🇩🇰|🇫🇮|🇫🇷|🇩🇪|🇮🇪|🇮🇹|🇱🇹|🇱🇺|🇳🇱|🇵🇱|🇸🇪|🇬🇧|CDG|FRA|AMS|MAD|BCN|FCO|MUC|BRU))(?!.*(排除1|排除2|5x)).*$";

  const FilterOT =
    "^(?!.*(DIRECT|直接连接|美|港|坡|台|新|日|韩|奥|比|保|克罗地亚|塞|捷|丹|爱沙|芬|法|德|希|匈|爱尔|意|拉|立|卢|马其它|荷|波|葡|罗|斯洛伐|斯洛文|西|瑞|英|🇭🇰|🇼🇸|🇹🇼|🇸🇬|🇯🇵|🇰🇷|🇺🇸|🇬🇧|🇦🇹|🇧🇪|🇨🇿|🇩🇰|🇫🇮|🇫🇷|🇩🇪|🇮🇪|🇮🇹|🇱🇹|🇱🇺|🇳🇱|🇵🇱|🇸🇪|HK|TW|SG|JP|KR|US|GB|CDG|FRA|AMS|MAD|BCN|FCO|MUC|BRU|HKG|TPE|TSA|KHH|SIN|XSP|NRT|HND|KIX|CTS|FUK|JFK|LAX|ORD|ATL|DFW|SFO|MIA|SEA|IAD|LHR|LGW))";

  const FilterAL =
    "^(?!.*(DIRECT|直接连接|群|邀请|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|特别|访问|支持|教程|关注|更新|作者|加入|USE|USED|TOTAL|EXPIRE|EMAIL|Panel|Channel|Author))";

  // ==================== 策略组公共列表 ====================

  const selectFB = [
    "故障转移",
    "香港策略",
    "狮城策略",
    "日本策略",
    "韩国策略",
    "美国策略",
    "台湾策略",
    "欧盟策略",
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
    "欧盟策略",
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
    "欧盟策略",
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
    "欧盟策略",
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
    "欧盟策略",
    "冷门自选",
    "全球手动",
    "直接连接"
  ];

  // ==================== 工具函数 ====================

  function selectGroup(
    name,
    proxiesList,
    icon
  ) {
    return {
      name: name,
      type: "select",
      proxies: proxiesList.slice(),
      icon: icon
    };
  }

  function regionSelect(
    name,
    filter,
    autoName,
    hashName,
    rrName,
    icon
  ) {
    return {
      name: name,
      type: "select",

      proxies: [
        autoName,
        hashName,
        rrName
      ],

      "include-all": true,

      filter: filter,

      "empty-fallback": "COMPATIBLE",

      icon: icon
    };
  }

  function urlTest(
    name,
    filter
  ) {
    return {
      name: name,

      type: "url-test",

      interval: 200,

      lazy: true,

      url:
        "https://www.google.com/generate_204",

      hidden: true,

      "include-all": true,

      filter: filter,

      "empty-fallback": "COMPATIBLE",

      icon:
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Auto.png"
    };
  }

  function loadBalance(
    name,
    filter,
    strategy,
    icon
  ) {
    return {
      name: name,

      type: "load-balance",

      interval: 200,

      lazy: true,

      url:
        "https://www.google.com/generate_204",

      strategy: strategy,

      hidden: true,

      "include-all": true,

      filter: filter,

      "empty-fallback": "COMPATIBLE",

      icon: icon
    };
  }

  // ==================== 全球手动节点排序 ====================
  // 仅影响“全球手动”代理组，不修改其他代理组和机场原始节点顺序。

  function getGlobalManualProxies() {
    if (!Array.isArray(config.proxies)) {
      return [];
    }

    const excludeRegex =
      /(群|邀请|返利|循环|官网|客服|网站|网址|获取|订阅|流量|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|贩卖|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|特别|访问|支持|教程|关注|更新|作者|加入|USE|USED|TOTAL|EXPIRE|EMAIL|Panel|Channel|Author)/i;

    function getPriority(name) {
      if (/(香港|🇭🇰|\bHK\b|Hong\s*Kong|HKG)/i.test(name)) {
        return 10;
      }

      if (/(台湾|台灣|🇹🇼|\bTW\b|Taiwan|TPE|TSA|KHH)/i.test(name)) {
        return 20;
      }

      if (/(新加坡|狮城|獅城|🇸🇬|\bSG\b|Singapore|SIN|XSP)/i.test(name)) {
        return 30;
      }

      if (/(日本|🇯🇵|\bJP\b|Japan|NRT|HND|KIX|CTS|FUK)/i.test(name)) {
        return 40;
      }

      if (/(韩国|韓國|首尔|首爾|🇰🇷|\bKR\b|Korea|KOR)/i.test(name)) {
        return 50;
      }

      if (/(美国|美國|🇺🇸|\bUS\b|USA|United\s*States|LAX|SFO|JFK|SJC|SEA|IAD|ORD|ATL|DFW|MIA)/i.test(name)) {
        return 60;
      }

      if (/(英国|英國|🇬🇧|\bUK\b|\bGB\b|United\s*Kingdom|London|LHR|LGW)/i.test(name)) {
        return 70;
      }

      if (/(德国|德國|🇩🇪|\bDE\b|Germany|Frankfurt|FRA|MUC)/i.test(name)) {
        return 80;
      }

      if (/(法国|法國|🇫🇷|\bFR\b|France|Paris|CDG)/i.test(name)) {
        return 90;
      }

      return 1000;
    }

    return config.proxies
      .map((proxy, index) => ({
        name: proxy && proxy.name,
        index: index
      }))
      .filter(
        item =>
          item.name &&
          !excludeRegex.test(item.name)
      )
      .sort((a, b) => {
        const priorityDiff =
          getPriority(a.name) -
          getPriority(b.name);

        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        return a.index - b.index;
      })
      .map(item => item.name);
  }

  const globalManualProxies =
    getGlobalManualProxies();

  const globalManualProviders =
    config["proxy-providers"] &&
    typeof config["proxy-providers"] === "object"
      ? Object.keys(config["proxy-providers"])
      : [];

  // ==================== 代理组 ====================

  config["proxy-groups"] = [
    // ---------- 全球手动置顶 ----------

    {
      name: "全球手动",

      type: "select",

      proxies: globalManualProxies,

      use: globalManualProviders,

      filter: FilterAL,

      "empty-fallback": "COMPATIBLE",

      icon:
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Clubhouse.png"
    },

    // ---------- 主要策略组 ----------

    selectGroup(
      "默认代理",
      selectFB,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Static.png"
    ),

    {
      name: "故障转移",

      type: "fallback",

      interval: 200,

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
        "欧盟策略",
        "全球手动",
        "冷门自选",
        "直接连接"
      ],

      icon:
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/ULB.png"
    },

    selectGroup(
      "国外流量",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Global.png"
    ),

    selectGroup(
      "国内流量",
      selectDC,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/China.png"
    ),

    selectGroup(
      "兜底流量",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Final.png"
    ),

    {
      name: "直接连接",

      type: "select",

      proxies: [
        "DIRECT"
      ],

      hidden: true,

      icon:
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Direct.png"
    },

    // ---------- 功能策略组 ----------

    {
      name: "网络测试",

      type: "select",

      proxies: selectPY.slice(),

      "include-all": true,

      filter: FilterAL,

      "empty-fallback": "COMPATIBLE",

      icon:
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Speedtest.png"
    },

    {
      name: "UKwifi",

      type: "select",

      proxies: [
        "DIRECT",
        "欧盟策略"
      ],

      icon:
        "https://www.giffgaff.design/iconography/icons/library/coverage-signal.svg"
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
        "欧盟策略"
      ],

      icon:
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Null_Nation.png"
    },

    // ---------- 媒体 ----------

    selectGroup(
      "Emby服",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Emby.png"
    ),

    selectGroup(
      "油管视频",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/YouTube.png"
    ),

    selectGroup(
      "奈飞视频",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Netflix.png"
    ),

    selectGroup(
      "国际媒体",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/DomesticMedia.png"
    ),

    selectGroup(
      "新闻媒体",
      selectUS,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Apple_News.png"
    ),

    // ---------- 社交 ----------

    selectGroup(
      "电报消息",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Telegram_X.png"
    ),

    selectGroup(
      "推特社交",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/X.png"
    ),

    selectGroup(
      "社交平台",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/PBS.png"
    ),

    // ---------- 服务 ----------

    selectGroup(
      "人工智能",
      selectUS,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/AI.png"
    ),

    selectGroup(
      "货币平台",
      selectSG,
      "https://raw.githubusercontent.com/Orz-3/mini/master/Alpha/Bitcloud.png"
    ),

    selectGroup(
      "游戏平台",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Game.png"
    ),

    selectGroup(
      "Github",
      selectPY,
      "https://raw.githubusercontent.com/lige47/QuanX-icon-rule/main/icon/04ProxySoft/github(1).png"
    ),

    selectGroup(
      "微软服务",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Microsoft.png"
    ),

    selectGroup(
      "谷歌服务",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Google_Search.png"
    ),

    selectGroup(
      "苹果服务",
      selectPY,
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Apple.png"
    ),

    // ---------- 地区 ----------

    regionSelect(
      "香港策略",
      FilterHK,
      "香港自动",
      "香港均衡-散列",
      "香港均衡-轮询",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Hong_Kong.png"
    ),

    regionSelect(
      "台湾策略",
      FilterTW,
      "台湾自动",
      "台湾均衡-散列",
      "台湾均衡-轮询",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Taiwan.png"
    ),

    regionSelect(
      "狮城策略",
      FilterSG,
      "狮城自动",
      "狮城均衡-散列",
      "狮城均衡-轮询",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Singapore.png"
    ),

    regionSelect(
      "日本策略",
      FilterJP,
      "日本自动",
      "日本均衡-散列",
      "日本均衡-轮询",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Japan.png"
    ),

    regionSelect(
      "韩国策略",
      FilterKR,
      "韩国自动",
      "韩国均衡-散列",
      "韩国均衡-轮询",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Korea.png"
    ),

    regionSelect(
      "美国策略",
      FilterUS,
      "美国自动",
      "美国均衡-散列",
      "美国均衡-轮询",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/United_States.png"
    ),

    regionSelect(
      "欧盟策略",
      FilterEU,
      "欧盟自动",
      "欧盟均衡-散列",
      "欧盟均衡-轮询",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/European_Union.png"
    ),

    // ---------- 其他 ----------

    {
      name: "冷门自选",

      type: "select",

      "include-all": true,

      filter: FilterOT,

      "empty-fallback": "COMPATIBLE",

      icon:
        "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Europe_Map.png"
    },

    // ---------- 自动测速 ----------

    urlTest(
      "香港自动",
      FilterHK
    ),

    urlTest(
      "台湾自动",
      FilterTW
    ),

    urlTest(
      "狮城自动",
      FilterSG
    ),

    urlTest(
      "日本自动",
      FilterJP
    ),

    urlTest(
      "韩国自动",
      FilterKR
    ),

    urlTest(
      "美国自动",
      FilterUS
    ),

    urlTest(
      "欧盟自动",
      FilterEU
    ),

    // ---------- 散列负载均衡 ----------

    loadBalance(
      "香港均衡-散列",
      FilterHK,
      "consistent-hashing",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin_1.png"
    ),

    loadBalance(
      "台湾均衡-散列",
      FilterTW,
      "consistent-hashing",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin_1.png"
    ),

    loadBalance(
      "狮城均衡-散列",
      FilterSG,
      "consistent-hashing",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin_1.png"
    ),

    loadBalance(
      "日本均衡-散列",
      FilterJP,
      "consistent-hashing",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin_1.png"
    ),

    loadBalance(
      "韩国均衡-散列",
      FilterKR,
      "consistent-hashing",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin_1.png"
    ),

    loadBalance(
      "美国均衡-散列",
      FilterUS,
      "consistent-hashing",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin_1.png"
    ),

    loadBalance(
      "欧盟均衡-散列",
      FilterEU,
      "consistent-hashing",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin_1.png"
    ),

    // ---------- 轮询负载均衡 ----------

    loadBalance(
      "香港均衡-轮询",
      FilterHK,
      "round-robin",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin.png"
    ),

    loadBalance(
      "台湾均衡-轮询",
      FilterTW,
      "round-robin",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin.png"
    ),

    loadBalance(
      "狮城均衡-轮询",
      FilterSG,
      "round-robin",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin.png"
    ),

    loadBalance(
      "日本均衡-轮询",
      FilterJP,
      "round-robin",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin.png"
    ),

    loadBalance(
      "韩国均衡-轮询",
      FilterKR,
      "round-robin",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin.png"
    ),

    loadBalance(
      "美国均衡-轮询",
      FilterUS,
      "round-robin",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin.png"
    ),

    loadBalance(
      "欧盟均衡-轮询",
      FilterEU,
      "round-robin",
      "https://github.com/Koolson/Qure/raw/master/IconSet/Color/Round_Robin.png"
    )
  ];

  // ==================== 分流规则 ====================

  config.rules = [
    "RULE-SET,Tracking,REJECT",
    "RULE-SET,AWAvenueAds,REJECT",
    "RULE-SET,Advertising,REJECT",

    "AND,((DST-PORT,443),(NETWORK,UDP)),REJECT",

    "RULE-SET,ukwifi,UKwifi",
    "RULE-SET,LocationDKS,抖快书定位",
    "RULE-SET,Private,直接连接",
    "RULE-SET,Direct,直接连接",
    "RULE-SET,XPTV,直接连接",
    "RULE-SET,Download,直接连接",
    "RULE-SET,AppleCN,直接连接",
    "RULE-SET,AI,人工智能",
    "DOMAIN-KEYWORD,speedtest,网络测试",
    "RULE-SET,Speedtest,网络测试",
    "RULE-SET,Twitter,推特社交",
    "RULE-SET,Telegram,电报消息",
    "RULE-SET,SocialMedia,社交平台",
    "RULE-SET,NewsMedia,新闻媒体",
    "DOMAIN-SUFFIX,steamserver.net,DIRECT",
    "RULE-SET,Games,游戏平台",
    "RULE-SET,Crypto,货币平台",
    "RULE-SET,Emby,Emby服",
    "RULE-SET,Netflix,奈飞视频",
    "RULE-SET,YouTube,油管视频",
    "RULE-SET,Streaming,国际媒体",
    "RULE-SET,Apple,苹果服务",
    "RULE-SET,Google,谷歌服务",
    "RULE-SET,github,Github",
    "RULE-SET,Microsoft,微软服务",
    "RULE-SET,Proxy,国外流量",
    "RULE-SET,China,国内流量",

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
    "RULE-SET,ChinaIP,国内流量",

    "MATCH,兜底流量"
  ];

  // ==================== Rule Providers ====================

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

    ukwifi: {
      type: "http",
      behavior: "classical",
      format: "text",
      interval: 86400,
      url:
        "https://raw.githubusercontent.com/HenryChiao/wificalling/refs/heads/main/qiao/wificalling.list"
    },

    AWAvenueAds: domainYAML(
      "https://raw.githubusercontent.com/TG-Twilight/AWAvenue-Ads-Rule/main/Filters/AWAvenue-Ads-Rule-Clash.yaml"
    ),

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

  return config;
}
