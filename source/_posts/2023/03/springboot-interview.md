---
title: springboot源码
date: 2023-03-23 21:19:36
tags:
---

# 1. 基础

通过`AnnotationConfigApplicationContext`可以创建一个Spring容器：

```java
public class MySpringApplication {

    public static void main(String[] args) {
        AnnotationConfigApplicationContext applicationContext = new AnnotationConfigApplicationContext(AppConfig.class);

        UserService userService = (UserService) applicationContext.getBean("userService");
        userService.test();
    }

}

@ComponentScan("pers.xds.springboot")
public class AppConfig {
}

```

## 1.1 生命周期

可以在`AbstractAutowireCapableBeanFactory#doCreateBean`中看到完整的bean生成流程。

大致分为如下过程：

1.对Bean进行实例化

2.依赖注入

3.如果Bean实现了`BeanNameAware`接口，Spring将调用`setBeanName()`，设置 `Bean`的 id（xml文件中bean标签的id）

4.如果Bean实现了`BeanFactoryAware`接口，Spring将调用`setBeanFactory()`

5.如果Bean实现了`ApplicationContextAware`接口，Spring容器将调用`setApplicationContext()`

6.如果存在`BeanPostProcessor`，Spring将调用它们的`postProcessBeforeInitialization`（预初始化）方法，在Bean初始化前对其进行处理

7.如果Bean实现了`InitializingBean`接口，Spring将调用它的`afterPropertiesSet`方法，然后调用xml定义的 init-method方法(初始化)，两个方法作用类似，都是在初始化 bean 的时候执行

8.如果存在`BeanPostProcessor`，Spring将调用它们的`postProcessAfterInitialization`（后初始化）方法，在Bean初始化后对其进行处理

9.Bean初始化完成，供应用使用，直到应用被销毁

10.如果Bean实现了`DisposableBean`接口，Spring将调用它的`destory`方法，然后调用在xml中定义的 `destory-method`方法，这两个方法作用类似，都是在Bean实例销毁前执行。

## 1.2 BeanFactory和FactoryBean的区别

`BeanFactory`：管理Bean的容器，Spring中生成的Bean都是由这个接口的实现来管理的。

`FactoryBean`：让开发者以编程的方式来创建一个bean，一般用于创建比较复杂的bean。

## 1.3 Bean注入容器有哪些方式

1、使用`@Configuration`与`@Bean`注解

2、使用`@Controller`、`@Service`、`@Repository`、`@Component` 注解标注该类，然后启用`@ComponentScan`自动扫描

3、使用`@Import` 方法，使用@Import注解把bean导入到当前容器中。

## 1.4 Bean的作用域

1、singleton：单例，Spring中的bean默认都是单例的。

2、prototype：每次请求都会创建一个新的bean实例。

3、request：每一次HTTP请求都会产生一个新的bean，该bean仅在当前HTTP request内有效。

4、session：每一次HTTP请求都会产生一个新的bean，该bean仅在当前HTTP session内有效。

5、application：限定一个Bean的作用域为`ServletContext`的生命周期。该作用域仅适用于web的Spring WebApplicationContext环境。

## 1.5 自动装配的方式

`@Autowired`注解会优先根据类型来注入，当有多个bean时，会尝试根据变量名来注入(byname)，如果没有找到就抛出异常。

可以通过`@Qualifier`来指定要注入的bean的名称。

`@Resource`注解会优先byname，找不到再byType。

## 1.6 @Bean和@Component的区别

`@Bean`只能作用于方法上，表示这个方法会返回一个Bean，一般需要配合`@Configuration`使用。

`@Component`只能作用于类型上，表示这个类会作为组件类，并告诉Spring要为这个类创建bean。

### 1.6.1 @Bean必须在@Configuration里使用吗?

[Spring: @Bean can still work without @Configuration - Stack Overflow](https://stackoverflow.com/questions/40256702/spring-bean-can-still-work-without-configuration)

`@Bean`在`@Configuration`表示的类里使用时，Spring会为其自动创建一个动态代理对象，在同一个配置类中可以直接调用方法来获取Bean：

```java
@Configuration
public class ExampleConfiguration {
    
    @Bean
    public Datasource datasource() {
        BasicDatasource datasource = new BasicDatasource();
        // ...
        return datasource;
    }
    
    public PlatformTransactionManager transactionManager() {
      	// 注意这里是直接调用了方法，每次调用都会返回同一个bean，并不会多次创建
        return new DataSourceTransactionManager(datasource());
    }
    
}
```

而在非`@Configuration`下定义的`@Bean`会以Lite Mode运作，在该模式下调用其它`@Bean`方法时，则是普通的方法调用(没有代理对象去拦截调用)。

## 1.7 Spring怎么解决循环依赖问题

对于构造器注入的循环依赖：Spring处理不了，直接抛出`BeanCurrentlylnCreationException`异常。

非单例循环依赖：无法处理。

单例模式下属性注入的循环依赖会通过三级缓存处理循环依赖：

`singletonObjects`：完成了初始化的单例对象map，bean name --> bean instance

`earlySingletonObjects`：完成实例化未初始化的单例对象map，bean name --> bean instance

`singletonFactories`： 单例对象工厂map，bean name --> ObjectFactory，存放 bean 工厂对象

具体的执行逻辑可以在`DefaultSingletonBeanRegistry`中看到，这里贴出核心方法：

```java
protected Object getSingleton(String beanName, boolean allowEarlyReference) {
    Object singletonObject = this.singletonObjects.get(beanName);
    if (singletonObject == null && this.isSingletonCurrentlyInCreation(beanName)) {
        singletonObject = this.earlySingletonObjects.get(beanName);
        if (singletonObject == null && allowEarlyReference) {
            synchronized(this.singletonObjects) {
                singletonObject = this.singletonObjects.get(beanName);
                if (singletonObject == null) {
                    singletonObject = this.earlySingletonObjects.get(beanName);
                    if (singletonObject == null) {
                        ObjectFactory<?> singletonFactory = (ObjectFactory)this.singletonFactories.get(beanName);
                        if (singletonFactory != null) {
                            singletonObject = singletonFactory.getObject();
                            this.earlySingletonObjects.put(beanName, singletonObject);
                            this.singletonFactories.remove(beanName);
                        }
                    }
                }
            }
        }
    }

    return singletonObject;
}
```

## 1.8 Spring的单例Bean是否有线程安全问题

当多个用户同时请求一个服务时，容器会给每一个请求分配一个线程，这时多个线程会并发执行该请求对应的业务逻辑，如果业务逻辑有对单例状态的修改（体现为此单例的成员属性），则必须考虑线程安全问题。

若每个线程中对全局变量、静态变量只有读操作，而无写操作，那么不会有线程安全问题；若有多个线程同时执行写操作，一般都需要考虑线程同步，否则就可能影响线程安全。

**无状态bean和有状态bean**

- 有实例变量的bean，可以保存数据，是非线程安全的。
- 没有实例变量的对象。不能保存数据，是线程安全的。

在Spring中无状态的Bean适合用单例模式，这样可以共享实例提高性能。有状态的Bean在多线程环境下不安全，一般用Prototype模式或者使用ThreadLocal解决线程安全问题。

## 1.9 Spring容器的启动过程

[阿里面试真题：Spring容器启动流程_spring启动流程面试题_敖 丙的博客-CSDN博客](https://blog.csdn.net/qq_35190492/article/details/110383213)

# 2. AOP

常见的动态代理有两种：

- JDK动态代理：基于Java反射机制实现，必须要实现了接口的业务类才生成代理对象。

- CGLIB动态代理：基于ASM机制实现，通过生成业务类的子类作为代理类。

JDK Proxy的优势：

​	最小化依赖关系、代码实现简单、简化开发和维护、JDK原生支持，比CGLIB更加可靠，随JDK版本平滑升级。而字节码类库通常需要进行更新以保证在新版Java上能够使用。

CGLIB的优势：

​	无需实现接口，达到代理类无侵入，只操作关心的类，而不必为其他相关类增加工作量。高性能。

[Java动态代理之一CGLIB详解 - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/115744594)

# 3. Spring事务

[可能是最漂亮的Spring事务管理详解 - 掘金 (juejin.cn)](https://juejin.cn/post/6844903608224333838)

# 4. MyBatis工作原理

[一文搞懂Mybatis架构与工作原理 - 掘金 (juejin.cn)](https://juejin.cn/post/6993253212853633055#heading-8)

1. 加载映射文件(通过动态代理和xml为接口生成对应的代理类)

2. 构造会话工程(SqlSessionFactory)

3. 创建会话对象(SqlSession)

   ```java
   try (SqlSession session = sqlSessionFactory.openSession()) {
     BlogMapper mapper = session.getMapper(BlogMapper.class);
     Blog blog = mapper.selectBlog(101);
   }
   ```

4. Executor执行器

   Mybatis会通过Executor去执行SQL语句。一般这里面会有缓存的实现。

5. MappedStatement对象

   对映射信息的封装，它存储了一个SQL对应的所有信息。Mybatis 通过解析 XML 和 mapper 接口上的注解，生成 sql 对应的 MappedStatement 实例

6. 输入参数映射

7. 输出参数映射

​	将数据库输出转换为 `Map`，`List`或自定义的类型

![](https://5j9g3t.site/public/post/2023-3-2-ca9cc3cd-cb95-4437-8182-2476f326260d.webp)
