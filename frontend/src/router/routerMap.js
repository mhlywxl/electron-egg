/**
 * 基础路由
 * @type { *[] }
 */

const constantRouterMap = [
  {
    path: '/',
    name: 'index',
    redirect: { name: 'toolar' }
  },
  {
    path: '/home',
    name: '首页',
    component: () => import('@/views/main/home.vue')
  },
  {
    path: '/tabbar',
    name: 'toolar',
    component: () => import('@/views/main/toolbar.vue')
  },
  // {
  //   path: '/',
  //   name: 'Example',
  //   redirect: { name: 'ExampleHelloIndex' },
  //   children: [
  //     {
  //       path: '/example',
  //       name: 'ExampleHelloIndex',
  //       component: () => import('@/views/example/hello/Index.vue')
  //     },
  //   ]
  // },
]

export default constantRouterMap
