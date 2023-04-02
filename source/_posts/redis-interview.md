---
title: redis面试
date: 2023-03-28 22:21:42
tags:
---

# 1. Redis字典

[深入理解Redis 数据结构—字典 - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/555430730)

> 可以这样理解：Redis的字典就是java7的HashMap，即哈希表+链表

Redis字典使用的哈希表结构如下：[redis/dict.h at 2.6 · redis/redis (github.com)](https://github.com/redis/redis/blob/2.6/src/dict.h#L68-L73)

```c++
typedef struct dictht {
     // table 数组
    dictEntry **table;
    // 哈希表的大小
    unsigned long size;
    // 等于size-1，用于计算索引值, 这里说明size肯定是2的幂
    unsigned long sizemask;
    // 已有的键值对数量
    unsigned long used;
} dictht;
```

`dictEntry`就是哈希节点了：[redis/dict.h at 2.6 · redis/redis (github.com)](https://github.com/redis/redis/blob/2.6/src/dict.h#L47-L55)

```c++
typedef struct dictEntry {
    // 键
    void *key;
    // 值   
    union {
        void *val;
        uint64_t u64;
        int64_t s64;
    } v;
    // 指向下一个哈希表节点，形成链表
    struct dictEntry *next;
} dictEntry;
```

Redis中的字典则由`dict`组成：[redis/dict.h at 2.6 · redis/redis (github.com)](https://github.com/redis/redis/blob/2.6/src/dict.h#L75-L81)

```c++
typedef struct dict {
    // 类型特定的函数，提供增删改查等功能 
    dictType *type;
   // 私有函数
    void *privdata;
    // 哈希表, 这里的二维是后面用来扩容的
    dictht ht[2];
    // rehash 索引，记录了当前扩容的进度
    int rehashidx; /* rehashing not in progress if rehashidx == -1 */
    // 用来记录当前运行的安全迭代器数，当不为0的时候表示有安全迭代器正在执行，这时候就会暂停rehash操作
    int iterators; /* number of iterators currently running */
} dict;
```

![总览](https://xds.asia/public/post/2023-2-3-0c4958ca-7128-481d-807c-0c95384937ec.webp)



# 2. Redis扩容与缩容

我们用`ht[0].used/ht[0].size`表示负载因子

## 2.1 扩容

- 如果没有**fork**子进程在执行**RDB**或者**AOF**的持久化，一旦满足**负载因子大于等于1**，此时触发扩容；

- 如果有**fork**子进程在执行**RDB**或者**AOF**的持久化时，则需要满足**负载因子大于5**，此时触发扩容。

Redis在扩容时使用的是渐进式哈希，即每次值移动一部分的数据到新的哈希表中。

在字典`dict`中，`dict.ht[0]`代表旧的哈希表，`dict.ht[1]`代表新的哈希表，每次扩容时会将容量乘2，同时`dict.rehashidx`代表rehash的进度，表示`dict.ht[0]`中，小于该索引的值都已经被移动到`dict.ht[1]`中了，此时需要在`dict.ht[1]`中进行相关的增删改查操作，反之则在`dict.ht[0]`中进行。

在扩容期间，每次进行增删改查都会将`dict.rehashidx`加一，并进行相关的rehash操作。

在扩容完毕后，将`dict.ht[0]`指向`dict.ht[1]`，并删除旧的哈希表。

## 2.2 缩容

当负载因子小于0.1时，Redis就会对哈希表进行收缩操作。

相关操作和扩容一样，在`dict.ht[1]`处创建新的哈希表，之后再渐进式rehash。

## 2.3 其它问题

假如在rehash扩容的时候，我们一直插入，会不会导致再次扩容呢？

假设此时哈希表容量为`n`，元素数量为`n`，在扩容哈希表容量后变为`2n`，而对于Redis来说，完成rehash需要`2n - n = n`次操作，所以我们最多进行`n`次插入，插入完后元素数量也变为`2n`，再次触发扩容。

对于负载因子为5的时候，假设此时哈希表容量为`n`，元素数量为`5n + 1`，扩容后哈希表容量为`2n`，同样我们可以插入`n`个元素，此时元素数量变为`6n + 1`，负载因子为`(6n + 1) / 2n`约等于3，此时不会触发扩容。

# 3. 字典遍历

## 3.1 全遍历

使用如下指令就会执行全遍历，返回所有的key：

```shell
keys *
```

优点：

- 返回的key不会重复

缺点：

- 在遍历完前会阻塞服务器

迭代器结构：

```c++
typedef struct dictIterator {
    dict *d; //迭代的字典
    int index; //当前迭代到Hash表中哪个索引值
    int table, safe; //table用于表示当前正在迭代的Hash表,即ht[0]与ht[1]，safe用于表示当前创建的是否为安全迭代器
    dictEntry *entry, *nextEntry;//当前节点，下一个节点
    /* unsafe iterator fingerprint for misuse detection. */
    long long fingerprint;//字典的指纹，当字典未发生改变时，该值不变，发生改变时则值也随着改变
} dictIterator;
```

### 3.3.1 安全迭代器和非安全迭代器

[Redis源码学习——安全迭代器和非安全迭代器（一）_damanchen的博客-CSDN博客](https://blog.csdn.net/damanchen/article/details/89474695)

[Redis源码学习——安全迭代器和非安全迭代器（二）_damanchen的博客-CSDN博客](https://blog.csdn.net/damanchen/article/details/89479299)

[跋山涉水 —— 深入 Redis 字典遍历 - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/42156903)

安全迭代器：

- 迭代的时候不能rehash，可以进行过期键的删除

非安全迭代器：

- 迭代的时候可以rehash，但是不能进行删除等操作(字典只读)，通过`fingerprint`字段来判断字典是否发生变动



## 3.2 间接遍历

使用`scan`命令可以间接遍历，这个命令每次会返回一个下一个需要遍历的索引值：

```shell
redis 127.0.0.1:6379> scan 0
1) "17"
2)  1) "key:12"
    2) "key:8"
    3) "key:4"
    4) "key:14"
    5) "key:16"
    6) "key:17"
    7) "key:15"
    8) "key:10"
    9) "key:3"
   10) "key:7"
   11) "key:1"
redis 127.0.0.1:6379> scan 17
1) "0"
2) 1) "key:5"
   2) "key:18"
   3) "key:0"
   4) "key:2"
   5) "key:19"
   6) "key:13"
   7) "key:6"
   8) "key:9"
   9) "key:11"
```

[Redis SCAN 命令](https://redis.com.cn/commands/scan.html)

优点：

- 一次只返回部分内容，响应较快，不会较长时间阻塞服务器

缺点：

- 可能会返回重复的值

[redis scan 命令底层原理（为什么会重复扫描？）_redis scan命令原理_柏油的博客-CSDN博客](https://blog.csdn.net/ldw201510803006/article/details/124052245)

这里第一次看可能会有这个疑问，我们打个比方：

遍历顺序：00 -> 10 -> 01 -> 11

若正好遍历到10时扩容完毕了，则新顺序为：

000 -> 100 -> 010 -> 110 -> 001 -> 101 -> 011 -> 111

此时我们在第三个位置，即010那里。

这时候可能就有疑问了：<font color=red>100那里不就遍历不到了吗？这不是丢数据了吗？</font>

但这样其实是想多了，我们来看000和100，假如哈希表长度为4时，这两个索引下的元素会落到哪个哈希表下？

很明显，这两个位置的元素都会落到00这个索引的下面，因为哈希表长度为4时，索引位置的取法就是和`0x11`做与操作，而000和100低两位相同，所以它们俩在之前就在00处，以链表的形式组合在了一起，当遍历到10时，100也肯定被遍历了。

---

总结一下就是`scan`命令会在哈希表缩容的时候造成数据重复，在rehash的期间也会造成重复。

在rehash期间调用`scan`，Redis会先扫小表，假如最终索引为v，然后会接着在大表中从v开始扫。

# 4. 五大基本数据类型

在看数据类型前，我们再回顾一下entry的结构：

```c++
typedef struct dictEntry {
    // 键
    void *key;
    // 值   
    union {
        void *val;
        uint64_t u64;
        int64_t s64;
    } v;
    // 指向下一个哈希表节点，形成链表
    struct dictEntry *next;
} dictEntry;
```

有没有发现一个问题：这个v代表值，那么这个值是个什么东西？？

这里其实是C语言的union，可以让多个变量使用同一个内存空间：[C/C++ union 使用教程 (常见操作与缺陷) - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/595288133)

你可以这样理解：这里的v即有三种类型，即`void*`、`uint64_t`(64位无符号整数)、`int64_t`(64位有符号整数)。

对应`void*`你可以理解为Java中的`Object`类型，用它做参数的话就可以传入任意对象，更详细的信息可以看这篇博客：[void*（指针）的类型转换-专讲_void*转换_NeverLate_gogogo的博客-CSDN博客](https://blog.csdn.net/NeverLate_gogogo/article/details/79308195)

---

一般情况下`void*`都是指向`redisObject `：[redis/README.md at cb1717865804fdb0561e728d2f3a0a1138099d9d · redis/redis (github.com)](https://github.com/redis/redis/blob/cb1717865804fdb0561e728d2f3a0a1138099d9d/README.md?plain=1#L323)

```c++
struct redisObject {
    unsigned type:4;
    unsigned encoding:4;
    unsigned lru:LRU_BITS; /* LRU time (relative to global lru_clock) or
                            * LFU data (least significant 8 bits frequency
                            * and most significant 16 bits access time). */
    int refcount;
    void *ptr;
};
```

- `type`：没啥好说的，每种数据结构的标识符

- `encoding`：编码

  - 以string来说，就有三种：`int` , `embstr` , `raw`：

    ```shell
    127.0.0.1:6379> SET counter 1
    OK
    127.0.0.1:6379> OBJECT ENCODING counter
    "int"
    127.0.0.1:6379> SET name "Tom"
    OK
    127.0.0.1:6379> OBJECT ENCODING name
    "embstr"
    127.0.0.1:6379> SETBIT bits 1 1
    (integer) 0
    127.0.0.1:6379> OBJECT ENCODING bits
    "raw"
    ```

- `lru`：给Redis做内存淘汰用

- `refcount`：引用计数，这个值为0的时候这个对象会被清除

- `ptr`：指向对象的实际表示，可能有多个指向同一个对象，一般还要配合encoding判断

## 4.1 String

Redis 的字符串是动态字符串，是可以修改的字符串，可以勉强理解为Java里的`StringBuilder`。

当字符串需要扩容时，有如下两种情况：

-  当字符串长度小于 1M 时，扩容都是加倍现有的空间
- 超过 1M，扩容时一次只会多扩 1M 的空间

字符串最大长度为512MB。
数据结构：[redis/sds.h at cb1717865804fdb0561e728d2f3a0a1138099d9d · redis/redis (github.com)](https://github.com/redis/redis/blob/cb1717865804fdb0561e728d2f3a0a1138099d9d/src/sds.h#L45)

```c++
#define SDS_TYPE_5  0
#define SDS_TYPE_8  1
#define SDS_TYPE_16 2
#define SDS_TYPE_32 3
#define SDS_TYPE_64 4
typedef char *sds;

struct __attribute__ ((__packed__)) sdshdr8 {
    uint8_t len; /* used */
    uint8_t alloc; /* excluding the header and null terminator */
    unsigned char flags; /* 3 lsb of type, 5 unused bits */
    char buf[];
};
struct __attribute__ ((__packed__)) sdshdr16 {
    uint16_t len; /* used */
    uint16_t alloc; /* excluding the header and null terminator */
    unsigned char flags; /* 3 lsb of type, 5 unused bits */
    char buf[];
};
struct __attribute__ ((__packed__)) sdshdr32 {
    uint32_t len; /* used */
    uint32_t alloc; /* excluding the header and null terminator */
    unsigned char flags; /* 3 lsb of type, 5 unused bits */
    char buf[];
};
struct __attribute__ ((__packed__)) sdshdr64 {
    uint64_t len; /* used */
    uint64_t alloc; /* excluding the header and null terminator */
    unsigned char flags; /* 3 lsb of type, 5 unused bits */
    char buf[];
};
```

我们可以发现，字符串结构体基本由`len`(已使用的长度)、`alloc`(最大长度/分配的长度)、`flags`(标志信息)、`buf`(字符串内容)组成。

字符串拼接：[redis/sds.c at cb1717865804fdb0561e728d2f3a0a1138099d9d · redis/redis · GitHub](https://github.com/redis/redis/blob/cb1717865804fdb0561e728d2f3a0a1138099d9d/src/sds.c#LL483)

```c++
sds sdscatlen(sds s, const void *t, size_t len) {
    size_t curlen = sdslen(s);
    s = sdsMakeRoomFor(s,len);
    // 内存不足
    if (s == NULL) return NULL;
    memcpy(s+curlen, t, len);
    sdssetlen(s, curlen+len);
    s[curlen+len] = '\0';
    return s;
}
```

[要懂redis，首先得看懂sds（全网最细节的sds讲解） - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/269496479)

## 4.2 Hash

Hash类型有两种实现方式：

- ziplist 编码的哈希对象使用压缩列表作为底层实现
- hashtable 编码的哈希对象使用字典作为底层实现

[Redis之Hash数据结构底层原理_redis hash原理_不要迷恋发哥的博客-CSDN博客](https://blog.csdn.net/chongfa2008/article/details/119537064)

### 4.2.1 ziplist

`ziplist`的运作方式<font color=red>类似</font>于一个队列，当有一对键值时，先将值入队，再将键入队。

这种设计完全不符合哈希表的设计，所以只会在数据量较少时使用。

当发生如下情况时，`ziplist`会被转换为真正的哈希表(字典)：

- 当hash中的数据项的数目超过512的时候，也就是ziplist数据项超过1024的时候
- 当hash中插入的任意一个value的长度超过了64的时候

```text
area        |<---- ziplist header ---->|<----------- entries ------------->|<-end->|

size          4 bytes  4 bytes  2 bytes    ?        ?        ?        ?     1 byte
            +---------+--------+-------+--------+--------+--------+--------+-------+
component   | zlbytes | zltail | zllen | entry1 | entry2 |  ...   | entryN | zlend |
            +---------+--------+-------+--------+--------+--------+--------+-------+
                                       ^                          ^        ^
address                                |                          |        |
                                ZIPLIST_ENTRY_HEAD                |   ZIPLIST_ENTRY_END
                                                                  |
                                                         ZIPLIST_ENTRY_TAIL
```

| 字段    | 类型     | 说明                                |
| ------- | -------- | ----------------------------------- |
| zlbytes | uint32_t | 整个ziplist占用的内存字节数。       |
| zltail  | uint32_t | 到达ziplist表尾节点的偏移量。       |
| zllen   | uint16_t | ziplist中节点的数量。               |
| entryX  | ？       | ziplist的各个节点。                 |
| zlend   | uint8_t  | 常量0b111111，用于标记ziplist末尾。 |

每个`entry`的结构是这样的：

```text
+-----------------------+----------+---------+
| previous_entry_length | encoding | content |
+-----------------------+----------+---------+
```

`previous_entry_length`：前面一个节点的长度(字节)。若前面一个节点的长度小于254字节，则该属性占1个字节的宽度，反正则是占5个字节的宽度，第一个字节是常量`0xFE`(254)

`encoding`：记录content的类型

`content`：保存节点的值

我们可以发现`ziplist`不能从头开始遍历，因为每个节点的长度都是不一样的，在遍历的时候需要根据zltail的值<font color=red>从尾部开始向前遍历</font>。

### 4.2.2 hashtable

hashtable就和Redis最外层的字典是差不多的了。

## 4.3 List

对于List同样也有两种编码：

- ziplist：压缩列表
- linkedlist：双向链表

满足如下条件时，压缩列表会被转换为双向链表：

- 试图往列表新添加一个字符串值，且这个字符串的长度超过 server.list_max_ziplist_value （默认值为 64 ）
- ziplist 包含的节点超过 server.list_max_ziplist_entries （默认值为 512 ）

[Redis列表list 底层原理 - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/102422311)

## 4.4 Set

Set拥有两种编码：

- intset：使用数组维护set，数组是有序的
- hashtable：直接使用哈希表维护set

满足如下条件时intset将会被转换成hashtable：

- 保存了非整型的值
- 元素数量超过了512个

### 4.4.1 intset

数据结构：

```c++
typedef struct intset {
    // 这个编码用来决定contents的大小
    uint32_t encoding;
    uint32_t length;
    int8_t contents[];
} intset;
```

[redis/intset.h at 971b177fa338fe06cb67a930c6e54467d29ec44f · redis/redis (github.com)](https://github.com/redis/redis/blob/971b177fa338fe06cb67a930c6e54467d29ec44f/src/intset.h#L35)

[面试官：说说Redis中Set数据类型的底层实现 - 掘金 (juejin.cn)](https://juejin.cn/post/6998360508462006308)

## 4.5 zset(Sorted Set)

zset有两种实现：

- zipList：压缩列表
- skipList：跳表

满足如下条件时zipList会转换成skipList：

- 节点数量大于等于128(server.zset_max_ziplist_entries)
- 节点的长度大于等64(server.zset_max_ziplist_value)

[Redis 跳跃表skiplist(深入理解,面试再也不用怕)_redis skiplist_妖四灵.Shuen的博客-CSDN博客](https://blog.csdn.net/wangxuelei036/article/details/106272680)

![跳表](https://xds.asia/public/interview/2023-2-4-70e28030-df93-4d4d-9043-9e3afd7b975b.webp)

- header：指向跳跃表的表头节点
- tail：指向跳跃表的表尾节点
- level：记录目前跳跃表内，层数最大的那个节点的层数(表头节点的层数不计算在内)
- length：记录跳跃表的长度，也即是，跳跃表目前包含节点的数量(表头节点不计算在内)

节点数据结构：

```c++
typedef struct zskiplistNode {
    // 当前保存的值
    sds ele;
    // 分值，用于排序
    double score;
    // 前一个节点
    struct zskiplistNode *backward;
    // 当前层节点
    struct zskiplistLevel {
        struct zskiplistNode *forward;
        // 跳表的跨度
        unsigned long span;
    } level[];
} zskiplistNode;
```

[redis/server.h at 971b177fa338fe06cb67a930c6e54467d29ec44f · redis/redis (github.com)](https://github.com/redis/redis/blob/971b177fa338fe06cb67a930c6e54467d29ec44f/src/server.h#L1329)

```c++
// 跳表
typedef struct zskiplist {
    struct zskiplistNode *header, *tail;
    // 跳表的长度
    unsigned long length;
    // 最高层数
    int level;
} zskiplist;

// zset数据结构
typedef struct zset {
    dict *dict;
    zskiplist *zsl;
} zset;
```

# 5. Redis持久化方式

## 5.1 RDB

RDB即Redis Database，它会将Redis某一时刻的数据以文件的形式全量备份到磁盘。

Redis提供了两个指令来生成RDB，一个是SAVE，这个命令会阻塞主线程，直到RDB生成完毕。

另外一个则是BGSAVE，这时会fork一个子进程去专门负责写入RDB。

在读取数据时用到了写时复制(COW)技术，fork创建出的子进程，**与父进程共享内存空间**。也就是说，如果子进程**不对内存空间进行写入操作的话，内存空间中的数据并不会复制给子进程**，这样创建子进程的速度就很快了！

[LInux fork的写时复制(copy on write)_fork写时复制_富士康质检员张全蛋的博客-CSDN博客](https://blog.csdn.net/qq_34556414/article/details/108399543)

## 5.2 AOF

AOF即Append Only File，它会记录在redis服务器上执行过的命令来实现持久化的目的。

[Redis详解（七）------ AOF 持久化 - YSOcean - 博客园 (cnblogs.com)](https://www.cnblogs.com/ysocean/p/9114267.html)

Redis默认每秒执行一次AOF的写入。

### 5.2.1 AOF重写

为了防止AOF文件过大，当AOF的文件大小超过设定的阈值后，Redis就会启动AOF的文件压缩。

压缩前：

```shell
sadd animals "cat"
sadd animals "dog"
sadd animals "cat"
sadd animals "lion"
```

压缩后：

```shell
sadd animals "cat" "dog" "lion"
```

# 6. 内存

## 6.1 内存过期策略

Redis对于过期的key有两种删除策略：

- 定期删除
- 惰性删除

### 6.1.1 定期删除

Redis会将每个设置了过期时间的key放到一个独立的字典中，以后会定期按照某种算法来遍历里面的key。

默认每秒进行10次扫描，每次会随机选取一些key，然后删除其中过期的key，若某次删除的数量超过了选取的`1/4`，则会重复这一步骤。

### 6.1.2 惰性删除

在客户端访问某个key时，若这个key过期，则会将其删除。

## 6.2 内存淘汰策略

当没有可以被删除的key，且Redis内存不足时，此时会根据内存淘汰策略删除一些没有过期的key。

1. noeviction：当内存使用超过配置的时候会返回错误，不会驱逐任何键

2. allkeys-lru：加入键的时候，如果过限，首先通过LRU算法驱逐最久没有使用的键

3. volatile-lru：加入键的时候如果过限，首先从设置了过期时间的键集合中驱逐最久没有使用的键

4. allkeys-random：加入键的时候如果过限，从所有key随机删除

5. volatile-random：加入键的时候如果过限，从过期键的集合中随机驱逐

6. volatile-ttl：从配置了过期时间的键中驱逐马上就要过期的键

7. volatile-lfu：从所有配置了过期时间的键中驱逐使用频率最少的键

8. allkeys-lfu：从所有键中驱逐使用频率最少的键


关于LRU和LFU，在redisObject里会保存相关的参数：

```c++
struct redisObject {
    unsigned type:4;
    unsigned encoding:4;
    unsigned lru:LRU_BITS; /* LRU time (relative to global lru_clock) or
                            * LFU data (least significant 8 bits frequency
                            * and most significant 16 bits access time). */
    int refcount;
    void *ptr;
};
```

[redis/README.md at cb1717865804fdb0561e728d2f3a0a1138099d9d · redis/redis (github.com)](https://github.com/redis/redis/blob/cb1717865804fdb0561e728d2f3a0a1138099d9d/README.md?plain=1#L323)

- 当使用LRU算法时，`lru`整个值都用来表示相关访问时间。
- 当使用LFU算法时，低8位表示访问频率，高16位表示上一次访问时间

### 6.2.1 LRU

LRU即Least Recently Used-最近最少使用算法。

LRU会维护一个双向链表，对于新加入的数据或者最近被访问的数据，它们会被存/移动到链表头部，当内存不足的时候删除链表尾部的数据。

优点：

- 好实现

缺点：

- 冷数据可能会把热数据顶掉

### 6.2.2 LFU

LFU即Least Frequently Used-最不经常使用。其核心思想是“如果数据过去被访问多次，那么将来被访问的频率也更高”。

[LFU 缓存 - 提交记录 - 力扣（LeetCode）](https://leetcode.cn/submissions/detail/419560284/)

Redis的LFU和上面的LFU有一些不一样，一般的LFU有如下缺点：

- 新增的缓存容易被删除

而Redis在此基础上会将每个数据的访问次数设置为`5`，每次访问会根据其上次访问时间<font color=red>扣除</font>一定的访问次数，然后再根据生成的一个随机数，决定是否对访问次数字段加一：

```c++
uint8_t LFULogIncr(uint8_t counter) {
    if (counter == 255) return 255;
    double r = (double)rand()/RAND_MAX;
    double baseval = counter - LFU_INIT_VAL;
    if (baseval < 0) baseval = 0;
    // 访问次数越多，加一的概率越小
    double p = 1.0/(baseval*server.lfu_log_factor+1);
    if (r < p) counter++;
    return counter;
}
```

其中`server.lfu_log_factor`默认为10。

因为访问计数器的长度为8位，最大为255，如果每次访问都加一，很可能会导致溢出。

[16 | LFU算法和其他算法相比有优势吗？ (geekbang.org)](https://time.geekbang.org/column/article/413038)

