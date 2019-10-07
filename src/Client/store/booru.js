
const options = {
  hidePostsWhileLoading: true,
}

export const booru = {
  getters: {
    Posts: "getPosts",
    Limit: "getLimit",
    SourceBooru: "getSourceBooru",
  },
  mutations: {
    Posts: "setPosts",
    Limit: "setLimit",
    SourceBooru: "setSourceBooru",
  },
  actions: {
    FetchPosts: "fetchPosts",
    RefreshPosts: "refreshPosts",
  },
}

export const state = () => ({
  posts: [],
  limit: 100,
  sourceBooru: null,
  autocompleteResults: [],
})

export const getters = {
  [booru.getters.Posts]: s => s.posts,
  [booru.getters.Limit]: s => s.limit,
}

export const mutations = {
  [booru.mutations.Posts](state, posts) {
    state.posts = posts
  },
  [booru.mutations.Limit](state, limit) {
    state.limit = limit
  },
  [booru.mutations.SourceBooru](state, val) {
    state.sourceBooru = val
  },
}

export const actions = {
  async [booru.actions.FetchPosts](context) {
    const { state, commit, rootGetters, rootState, dispatch } = context

    if (options.hidePostsWhileLoading)
      commit('setPosts', [])

    dispatch('api/init', null, { root: true })
    const api = rootGetters['api/instance']

    // await dispatch('auth/ensureAuth', null, { root: true })

    let tags = rootState.route.params.tags
    if (tags === "*")
      tags = ""

    const res = await api.getPosts(tags, rootState.route.params.page, state.limit)
    if (res.isSuccess) {
      commit('setSourceBooru', res.data.sourceBooru)
      commit('setPosts', res.data.posts)
    } else {
      throw new Error(res.error.message)
    }
  },
  async [booru.actions.RefreshPosts]({ dispatch }) {
    dispatch('fetchPosts')
  },
}


