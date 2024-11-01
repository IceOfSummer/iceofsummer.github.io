---
title: MySql面试
date: 2023-04-02 15:22:42
tags:
---

# 1. B树和B+树之间的区别

> B树有些博客上会写成B-树，部分博客甚至读成了B减树，其实这个减号只是一个连接符，没有任何意义

[B-Tree Visualization (usfca.edu)](https://www.cs.usfca.edu/~galles/visualization/BTree.html)

[B+ Tree Visualization (usfca.edu)](https://www.cs.usfca.edu/~galles/visualization/BPlusTree.html)

B树和B+树的区别：

- B+树只会在叶子节点存储数据，而B树每个节点上都会有数据
- B+树每个叶子节点之间有一个指针乡相连

# 2. 高度为3的B+树能存多少条数据

[MySQL系列（4）— InnoDB数据页结构 - 掘金 (juejin.cn)](https://juejin.cn/post/6974225353371975693)

在InnoDB中，索引默认使用的数据结构为B+树，而B+树里的每个节点都是一个页，默认的页大小为`16KB`。

![page](https://5j9g3t.site/public/post/2023-3-0-fed73c7c-b6fb-40e4-9b27-1a95fccd77c8.webp)

# 3. 简单说一下InnoDB事务实现原理

事务ACID：

| 名称            | 别名   | 说明                                                         |
| --------------- | ------ | ------------------------------------------------------------ |
| **Atomicity**   | 原子性 | 原子性是指事务是一个不可分割的工作单位，事务中的操作要么都发生，要么都不发生 |
| **Consistency** | 一致性 | 事务前后数据的完整性必须保持一致                             |
| **Isolation**   | 隔离性 | 事务的隔离性是多个用户并发访问数据库时，数据库为每一个用户开启的事务，不能被其他事务的操作数据所干扰，多个并发事务之间要相互隔离 |
| **Durability**  | 持久性 | 持久性是指一个事务一旦被提交，它对数据库中数据的改变就是永久性的，接下来即使数据库发生故障也不应该对其有任何影响 |

[一文了解InnoDB事务实现原理 - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/48327345)

上面那个比较深入，下面这个比较好理解一些：

[图解InnoDB事务实现原理｜Redo Log&Undo Log - 掘金 (juejin.cn)](https://juejin.cn/post/7012937835967692808)

# 4.MySql的三大日志是哪些

[MySQL三大日志(binlog,redolog,undolog)详解 - 掘金 (juejin.cn)](https://juejin.cn/post/7090530790156533773)

[聊聊MVCC和Next-key Locks - 掘金 (juejin.cn)](https://juejin.cn/post/6844903842505555981)

[细聊 MySQL undo log、redo log、binlog 有什么用？](https://www.cnblogs.com/xiaolincoding/p/16396502.html)

## redolog

重做日志，用于 mysql 的崩溃恢复。在每次事务提交前，MySQL 都会将事务造成的修改记录成一小段数据，并将一小段输入写入缓冲流中，最后根据特定的策略决定什么时候将缓冲流写入到硬盘中。

`redolog` 在保存时，是以日志文件组的形式保存的，一个文件组中有多个文件，每个文件组合起来，构成一个类似环状链表的结构。在日志文件组中，分别由 `wirte pos` 和 `checkpoint` 保存相应的位置信息。`wirte pos` 主要保存当前 `redolog` 写到了哪里。`checkpoint` 则保存当前 `redolog` 执行到了哪里。

当`write pos` 追上 `checkpoint` 时，也就是 `redolog` 写满时，MySQL 会被阻塞，此时会停下来将 `Buffer Pool` 中的脏页刷新到磁盘中，然后标记 `redo log` 哪些记录可以被擦除，接着对旧的 `redo log` 记录进行擦除，等擦除完旧记录腾出了空间，`checkpoint` 就会往后移动，然后 MySQL 恢复正常运行，继续执行新的更新操作。

> [!NOTE]
> 所以，一次 checkpoint 的过程就是脏页刷新到磁盘中变成干净页，然后标记 redo log 哪些记录可以被覆盖的过程。

# 5. MySql当前读和快照度

[mysql快照读原理实现 - 掘金 (juejin.cn)](https://juejin.cn/post/7055073479866974238)

[MySQL 的可重复读到底是怎么实现的？图解 ReadView 机制 - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/166152616)

这里其实有个问题，如果我只是单独的一条查询语句，没有开启事务，那么怎么去快照读呢？

这个我自己查了一下，众所周知，MySql里有一个autocommit属性，对于单条SQL，这个值一定是true，那么是不是说明我们每条SQL都会被认作是一个事务呢？

然后我在官方文档里查了一下：

![每条SQL都是一个单独的事务](https://5j9g3t.site/public/interview/2023-2-0-bd1f976d-ac67-49a3-979b-1b9cd4fa2c6d.webp)

[MySQL :: MySQL 5.7 Reference Manual :: 14.7.2.2 autocommit, Commit, and Rollback](https://dev.mysql.com/doc/refman/5.7/en/innodb-autocommit-commit-rollback.html)

[MySQL :: MySQL 8.0 Reference Manual :: 15.7.2.2 autocommit, Commit, and Rollback](https://dev.mysql.com/doc/refman/8.0/en/innodb-autocommit-commit-rollback.html)

不管是8.0还是5.7，都是这样写的，那么就可以说的通了。每次执行单条SQL都会拿到一个事务id，然后再去进行快照读。

那么什么是当前读呢，使用下面的sql语句就是当前读：

```sql
# 加共享锁
SELECT ... LOCK IN SHARE MODE 
# 加排它锁
SELECT ... FROM UPDATE
```

这两条语句的原理就是给对应的行加上<font color=red>共享锁(读锁)或排它锁(写锁)</font>，当有事务进行增删改时也会加排它锁，对于共享锁，允许多个事务持有(即允许多读)，对于排它锁，则只允许一个事务持有(即只能一个人写，且除了自己其它人都不能读)。

在排它锁和共享锁下读的的数据就是当前读，这份数据永远是最新的(此时若有其它事务想要修改相关的行，都会被阻塞)。其它状况则就是快照读了，通过MVCC创建ReadView进行数据的读取。

# 6. MySql的MVCC

MVCC(Multiversion Concurrency Control)多版本并发控制。

首先在在MVCC下，每个表都会多出几个隐藏的列，分别为隐藏主键(row_id)、事务id(trx_id)、回滚指针(roll_pointer)。

MVCC还有两个重要的组成：undo log(回滚日志)、ReadView。

更详细的就不说了，因为上面的链接里面都有，主要是下面这四个关系：

（1）当【版本链中记录的 trx_id 等于当前事务id（trx_id = creator_trx_id）】时，说明版本链中的这个版本是当前事务修改的，所以该快照记录对当前事务可见。

（2）当【版本链中记录的 trx_id 小于活跃事务的最小id（trx_id < min_trx_id）】时，说明版本链中的这条记录已经提交了，所以该快照记录对当前事务可见。

（3）当【版本链中记录的 trx_id 大于下一个要分配的事务id（trx_id > max_trx_id）】时，该快照记录对当前事务不可见。

（4）当【版本链中记录的 trx_id 大于等于最小活跃事务id】且【版本链中记录的trx_id小于下一个要分配的事务id】（min_trx_id<= trx_id < max_trx_id）时，如果版本链中记录的 trx_id 在活跃事务id列表 m_ids 中，说明生成 ReadView 时，修改记录的事务还没提交，所以该快照记录对当前事务不可见；否则该快照记录对当前事务可见。

## 6.1 RepeatableRead是怎么实现的

我们都知道，RepeatableRead相比ReadCommited能够避免不可重复读的问题(实际也能够避免幻读，是通过加间隙锁实现的)。

首先我们来看ReadCommitted，使用mysql执行如下指令(假如我们叫它事务A)

```sql
set session transaction isolation level read committed;
begin;
update test set xid = 2 where id = 1;
# 等一会再提交
commit;
```

然后再开一个mysql执行如下指令(假如我们叫它事务B)：

```sql
set session transaction isolation level read committed;
begin;
select * from test where id = 1;
# 提交上面那个指令后再执行下面这条
select * from test where id = 1;
```

这里就不放图了，大家都知道第二次读取会不一样。

这回我们再将隔离级别设置为RepeatableRead，并同样执行上面的指令。

这次执行后，<font color=red>发现两次查询的结果都是一样的</font>，而且在事务A执行更新后且没有提交时，B再去读，<font color=red>并没有发生阻塞，因为在修改数据的时候会加排它锁，在读的时候要么是当前读要么是快照读，</font>如果是当前读，那么读操作会堵塞，说明在B这里是快照读，是创建了ReadView的，通过ReadView有效地避免了不可重复读。

我们再用同样的方式去验证ReadCommited级别的读，发现同样是快照读，那么凭什么RepeatableRead不会读到新值，而ReadCommited会呢？

这里我画了一个流程图方便理解：

![流程图](https://5j9g3t.site/public/interview/2023-2-1-7f41e3a0-6d4e-42e8-b44e-d85eecdbd465.webp)

~~图画的可能不太好，不过应该能看懂~~

网上大部分人讲的都是以ReadCommited级别为例子的，即m_ids里的事务提交后可读，但其实在RepeatableRead隔离级别下是读不了的，只能走undo_log进行回滚。

---

<font color=red>这里可能有点错误，在ReadCommited下可以读已经提交的事务，所以如果trx_id大于等于mid_id，只需要判断对应的事务是否已经提交(或者trx_id指向自己)就能读</font>

# 7. RepeatableRead真的不能避免幻读吗?

[美团三面：一直追问我， MySQL 幻读被彻底解决了吗？_肥肥技术宅的博客-CSDN博客](https://blog.csdn.net/m0_71777195/article/details/126968432)

# 8. 为什么bin_log不能用作崩溃后的恢复

[mysql 为什么不能用binlog来做数据恢复？ - 知乎 (zhihu.com)](https://www.zhihu.com/question/463438061)
