---
title: 服务降级
date: 2023-03-06 22:52:25
categories:
  data:
    - { name: "SpringCloud", path: "/2023/03/04/SpringCloud/" }
tags:
  data:
    - { name: "服务降级", path: "/SpringCloud/service-degradation"}
---

多个微服务之间调用的时候，假设微服务A调用微服务B和C，微服务B和微服务C又调用其它的微服务，这就是所谓的“扇出”。如果扇出链路上的某个微服务的调用响应时间过长或不可用，对微服务A的调用就会占用越来越多的系统资源，从而引起系统崩溃，这就是所谓的<font color="skyblue">“雪崩效应”</font>

对于高流量的应用来说，单一的后端依赖可能会导致所有服务器上的所有资源都在几秒钟内饱和。比失败更糟糕的是，这些应用程序还可能导致服务之间的延迟增加，备份队列，线程和其他系统资源紧张，导致整个系统发生更多的级联故障。这些都表示需要对故障和延迟进行隔离和管理，以便单个依赖关系的失败，不能取消整个应用程序或系统。

通常在一个模块下的某个实例失败后，这个模块仍然还会接收流量，然后这个有问题的模块还调用了其它的模块，这样就会发生联级故障，或者叫雪崩。

所以我们需要在一个依赖出现问题的情况下，<font color="red">不能导致整体的服务失败，避免级联故障，以提高分布式系统的弹性。</font>

"断路器”本身是一种开关装置，当某个服务单元发生故障之后，通过断路器的故障监控（类似熔断保险丝)，<font color="red">向调用方返回一个符合预期的、可处理的备选响应（FallBack)，而不是长时间的等待或者抛出调用方无法处理的异常</font>，这样就保证了服务调用方的线程不会被长时间、不必要地占用，从而避免了故障在分布式系统中的蔓延，乃至雪崩。

这里有三个重要概念：

- 服务降级

  [服务降级-阿里云开发者社区 (aliyun.com)](https://developer.aliyun.com/article/313046)

  在服务无法时候时，返回一个"fallback"给客户端，这就是服务降级。

  如下操作会触发降级：

  - 程序运行异常
  - 超时
  - 服务熔断触发服务降级
  - 线程池/信号量过多也会导致服务降级

- 服务熔断

  当服务器访问量过多时，直接拒绝后续的访问，然后调用服务降级的方法并返回相关提示

- 服务限流

  限制接口在一定时间的访问量，限制高并发等操作。

[Hystrix](hystrix)<font color="red">(已经进入维护模式)</font>

[Sentinel](sentinel)
