<template>
  <div class="tab-control-wrap">
    <div class="control-left">
      <el-tabs
        v-model="currentTabId"
        ref="elTabsRef"
        type="border-card"
        style="display: inline-block; max-width: calc(100vw - 230px)"
        :stretch="false"
        @tab-remove="removeTab"
        @tab-change="changeTab"
      >
        <el-tab-pane
          v-for="(item, index) in tabs"
          :key="item.time"
          :label="item.title"
          :name="item.tabId"
					:closable="index !== 0"
        >
          <template #label>
            <span class="custom-tabs-label">
              <el-icon v-if="item.isLoading" class="is-loading">
                <ep-Loading />
              </el-icon>
              <img v-else class="tab-icon" :src="item.favicon" />
              <span
                v-if="item.title.length > 9"
                :title="item.title"
                class="tab-title"
                >{{ item.title.slice(0, 9) }}</span
              >
              <span v-else class="tab-title">{{ item.title }}</span>
            </span>
          </template>
        </el-tab-pane>
      </el-tabs>
<!--      <el-icon title="新标签页" @click="addNewTab" class="add-new-tab">
        <ep-plus />
      </el-icon>-->
    </div>

    <div class="control-right">
      <el-icon title="刷新" @click="refresh" class="control-right-btn">
				<ep-refresh />
      </el-icon>
<!--			<el-dropdown ref="menu" :teleported="false" popper-class="menu-popper" trigger="click" class="dropdown-btn">-->
<!--				<el-icon title="菜单" class="icon" @click="showMenu">-->
<!--					<ep-more @click="showMenu" />-->
<!--				</el-icon>-->
<!--				<template #dropdown>-->
<!--					<el-dropdown-menu>-->
<!--						<el-dropdown-item>Action 1</el-dropdown-item>-->
<!--						<el-dropdown-item>Action 2</el-dropdown-item>-->
<!--						<el-dropdown-item>Action 3</el-dropdown-item>-->
<!--						<el-dropdown-item>Action 4</el-dropdown-item>-->
<!--						<el-dropdown-item>Action 5</el-dropdown-item>-->
<!--					</el-dropdown-menu>-->
<!--				</template>-->
<!--			</el-dropdown>-->
      <el-icon @click="showMenu" title="菜单" class="control-right-btn">
				<ep-more />
      </el-icon>
      <el-icon title="最小化" @click="minimize" class="control-right-btn">
        <ep-minus />
      </el-icon>
      <el-icon
        title="最大化"
        :size="13"
        @click="maximize"
        class="control-right-btn"
      >
        <ep-FullScreen />
      </el-icon>
      <el-icon
        title="关闭"
        @click="closeWindow"
        class="control-right-btn btn-close"
      >
        <ep-close />
      </el-icon>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { ipc } from '@/utils/ipcRenderer';

const tabs = ref([])
const currentTabId = ref(0)
const elTabsRef = ref({})

// 关闭tab页
const removeTab = (tabId) => {
  ipc.send('close-tab', tabId)
}

// 切换tab页
const changeTab = (tabId) => {
  ipc.send('switch-tab', tabId)
}

// 添加新tab
const addNewTab = () => {
  ipc.send('new-tab')
}

// 刷新
const refresh = () => {
  ipc.send('toMain', 'refreshWin')
}

// 最小化窗口
const minimize = () => {
  ipc.send('toMain', 'minimiseWin')
}

// 最大化窗口
const maximize = () => {
  ipc.send('toMain', 'maximiseOrRestoreWin')
}

// 关闭窗口
const closeWindow = () => {
  ipc.send('toMain', 'closeWin')
}

const showMenu = (e) => {
	console.log(e)
	ipc.send('topMenu', {action: 'show', x: e.clientX, y: e.clientY})
}

onMounted(() => {
	console.log(ipc)
  ipc.on(
    'tabs-update',
    (event, tabOptions) => {
			// console.log(event)
			// console.log(tabOptions)
			// console.log(tabOptions.confs)
			if (!tabOptions.confs) {
				return
			}
      const time = new Date().valueOf()
      tabs.value = Object.keys(tabOptions.confs).filter(id => tabOptions.confs[id]).map(tabId => {
        const obj = { ...tabOptions.confs[tabId], tabId: parseInt(tabId), time }
        if (!obj.title) obj.title = '新标签页'
        return obj
      })
    }
  )

  nextTick(() => {
    console.log('ref', elTabsRef)
  })

  // 获取当前显示的tab的id
  ipc.on('fromMain', (event, data) => {
    if (typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'currentTabId')) {
      currentTabId.value = data.currentTabId
    }
  })

  ipc.send(
    'control-ready'
  )
})

</script>

<style scoped>
.menu-popper {
	z-index: 99999 !important;
}
.tab-control-wrap {
  width: 100%;
  height: 40px;
  background-color: var(--el-fill-color-light);
  display: flex;
  justify-content: space-between;
  flex-wrap: nowrap;
  -webkit-app-region: drag;
}
.el-tabs--border-card {
  border: none;
}
.add-new-tab {
  vertical-align: top;
  transform: translateY(12px);
  margin-left: 10px;
  border-radius: 10px;
}
.add-new-tab:hover {
  cursor: pointer;
  color: #fdfdfe;
  background-color: var(--el-border-color-hover);
}
.custom-tabs-label {
  position: relative;
}
.tab-icon {
  width: 16px;
  height: 16px;
  vertical-align: middle;
  display: inline;
}
.tab-title::after {
  content: "";
  background: linear-gradient(
    90deg,
    transparent,
    transparent,
    transparent,
    transparent,
    transparent,
    transparent,
    transparent,
    transparent,
    transparent,
    transparent,
    transparent,
    rgba(255, 255, 255, 0.8)
  );
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}

.control-left {
  -webkit-app-region: no-drag;
}
.control-right {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
}
.control-right-btn, .dropdown-btn {
  width: 46px;
  height: 100%;
  font-size: 15px;
}
.dropdown-btn {
	display: flex;
	align-items: center;
	justify-content: center;
}
/*.dropdown-btn > .icon {*/
/*	width: 100%;*/
/*	height: 100%;*/
/*	display: flex;*/
/*	align-items: center;*/
/*	justify-content: center;*/
/*}*/
.control-right-btn:hover, .dropdown-btn:hover {
  cursor: pointer;
  background-color: #e5e5e5;
}
.btn-close:hover {
  color: #fff;
  background-color: #e81123;
}
</style>
