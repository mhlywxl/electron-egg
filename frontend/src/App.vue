<template>
<!--  <router-view/>-->
	<router-view v-slot="{ Component }">
		<component v-if="this.$route.name === 'tabBar'" :is="Component" />
		<transition
			v-else
			enter-active-class="motion-safe:transition-opacity-300 ease-out"
			enter-from-class="opacity-0"
			enter-to-class="opacity-100"
			leave-active-class="motion-safe:transition-opacity-300 ease-in"
			leave-from-class="opacity-100"
			leave-to-class="opacity-0"
		>
			<component :is="Component" />
		</transition>
	</router-view>
</template>

<script>
export default {
name: 'App',
setup() {
  document.getElementById('loadingPage').remove()
}
}
</script>
<style lang="less"></style>
