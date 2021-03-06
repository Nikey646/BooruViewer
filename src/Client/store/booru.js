import { api as apis } from "~/store/api"
import { ui as uis } from "~/store/ui"
import { auth as auths } from "~/store/auth"

const options = {
  hidePostsWhileLoading: true,
}

export const booru = {
  getters: {
    Posts: "getPosts",
    Limit: "getLimit",
    SourceBooru: "getSourceBooru",
    Notes: "getNotes",
    TagSearchResults: "getTagSearchResults",
  },
  mutations: {
    Posts: "setPosts",
    Limit: "setLimit",
    SourceBooru: "setSourceBooru",
    Notes: "setNotes",
    TagSearchResults: "setTagSearchResults",
  },
  actions: {
    FetchPosts: "fetchPosts",
    RefreshPosts: "refreshPosts",
    FetchNotes: "fetchNotes",
    ClearNotes: "clearNotes",
    FetchAutocompleteResults: "fetchAutocompleteResults",
    ClearAutocompleteResults: "clearAutocompleteResults",
  },
  RelatedTags: "relatedTags",
  AddFavorite: "addFavorite",
  RemoveFavorite: "removeFavorite",
  SavedSearches: "savedSearches",
}

export const state = () => ({
  posts: [],
  notes: [],
  autocompleteResults: [],
  limit: 100,
  sourceBooru: null,
  relatedTags: [], // string
  savedSearches: [], // label: string, query: string
  blacklist: ["*"],
})

export const getters = {
  [booru.getters.Posts]: s => s.posts,
  [booru.getters.Notes]: s => s.notes,
  [booru.getters.TagSearchResults]: s => s.autocompleteResults,
  [booru.getters.Limit]: s => s.limit,
  [booru.getters.SourceBooru]: s => s.sourceBooru,
  [booru.RelatedTags]: s => s.relatedTags,
  [booru.SavedSearches]: s => s.savedSearches,
}

export const mutations = {
  [booru.mutations.Posts](state, posts) {
    state.posts = posts
  },
  [booru.mutations.Notes](state, notes) {
    state.notes = notes
  },
  [booru.mutations.TagSearchResults](state, results) {
    state.autocompleteResults = results
  },
  [booru.mutations.Limit](state, limit) {
    state.limit = limit
  },
  [booru.mutations.SourceBooru](state, val) {
    state.sourceBooru = val
  },
  [booru.RelatedTags](state, tags) {
    state.relatedTags = tags
  },
  [booru.AddFavorite](state, postId) {
    const post = state.posts.find(p => p.id === postId)
    post.isFavourited = true
    post.favourites += 1
  },
  [booru.RemoveFavorite](state, postId) {
    const post = state.posts.find(p => p.id === postId)
    post.isFavourited = false
    post.favourites -= 1
  },
  [booru.SavedSearches](state, searches) {
    state.savedSearches = searches
  },
}

export const actions = {
  async [booru.actions.FetchPosts](context) {
    const { state, commit, rootGetters, rootState, dispatch } = context

    if (options.hidePostsWhileLoading)
      commit(booru.mutations.Posts, [])

    dispatch('api/' + apis.actions.Initialize, null, { root: true })
    const api = rootGetters['api/' + apis.getters.Instance]

    await dispatch('auth/' + auths.EnsureAuth, null, { root: true })

    let tags = rootState.route.params.tags
    if (tags === "*")
      tags = ""

    const res = await api.getPosts(tags.replace(/\+/g, " "), rootState.route.params.page, state.limit)
    if (res.isSuccess) {
      commit(booru.mutations.SourceBooru, res.data.sourceBooru)
      commit(booru.mutations.Posts, res.data.posts)
    } else {
      throw new Error(res.error.message)
    }
  },
  [booru.actions.RefreshPosts]({ dispatch }) {
    dispatch(booru.actions.FetchPosts)
  },
  async [booru.actions.FetchNotes](context, postId) {
    const { commit, rootGetters, dispatch } = context

    dispatch('api/' + apis.actions.Initialize, null, { root: true })
    const api = rootGetters['api/' + apis.getters.Instance]

    await dispatch('auth/' + auths.EnsureAuth, null, { root: true })

    const id = postId.id || postId.postId || postId

    const res = await api.getNotes(id)
    if (res.isSuccess) {
      commit(booru.mutations.Notes, res.data)
    } else {
      throw new Error(res.error.nessage);
    }
  },
  [booru.actions.ClearNotes]({ commit }) {
    commit(booru.mutations.Notes, [])
  },
  async [booru.actions.FetchAutocompleteResults](context, searchText) {
    const { commit, rootGetters, dispatch } = context

    commit(booru.mutations.TagSearchResults, [])

    dispatch('api/' + apis.actions.Initialize, null, { root: true })
    const api = rootGetters['api/' + apis.getters.Instance]

    if (searchText == null || searchText.trim() === "")
      return

    const res = await api.getAutocompleteSuggestions(searchText)
    if (res.isSuccess) {
      commit(booru.mutations.TagSearchResults, res.data)
    } else {
      throw new Error(res.error.message)
    }
  },
  [booru.actions.ClearAutocompleteResults]({ commit }) {
    commit(booru.mutations.TagSearchResults, [])
  },
  async [booru.RelatedTags](context, tags) {
    const { commit, rootGetters, dispatch } = context

    commit(booru.RelatedTags, [])

    if (tags === undefined || tags.length === 0)
      return

    dispatch('api/' + apis.actions.Initialize, null, { root: true })
    const api = rootGetters['api/' + apis.getters.Instance]

    const res = await api.getRelatedTags(tags)
    if (res.isSuccess) {
      commit(booru.RelatedTags, res.data.tags)
    } else {
      throw new Error(res.error.message)
    }
  },
  async [booru.AddFavorite](context, postId) {
    const { commit, rootGetters, dispatch } = context

    dispatch('api/' + apis.actions.Initialize, null, { root: true })
    const api = rootGetters['api/' + apis.getters.Instance]

    await dispatch('auth/' + auths.EnsureAuth, null, { root: true })

    const res = await api.addFavorite(postId)
    if (res.isSuccess) {
      commit(booru.AddFavorite, postId)
    } else {
      throw new Error(res.error.message)
    }
  },
  async [booru.RemoveFavorite](context, postId) {
    const { commit, rootGetters, dispatch } = context

    dispatch('api/' + apis.actions.Initialize, null, { root: true })
    const api = rootGetters['api/' + apis.getters.Instance]

    await dispatch('auth/' + auths.EnsureAuth, null, { root: true })

    const res = await api.removeFavorite(postId)
    if (res.isSuccess) {
      commit(booru.RemoveFavorite, postId)
    } else {
      throw new Error(res.error.message)
    }
  },
  async [booru.SavedSearches](context) {
    const { state, commit, rootGetters, rootState, dispatch } = context

    if (options.hidePostsWhileLoading)
      commit(booru.SavedSearches, [])

    dispatch('api/' + apis.actions.Initialize, null, { root: true })
    const api = rootGetters['api/' + apis.getters.Instance]

    await dispatch('auth/' + auths.EnsureAuth, null, { root: true })

    const res = await api.getSavedSearches()
    if (res.isSuccess) {
      const all = {
        label: "all",
        query: "search:all",
      }

      const labels = [...new Set(res.data.flatMap(s => s.labels))]
      const sortedLabelObjs = labels.sort((left, right) => {
        if (left < right)
          return -1
        if (left > right)
          return 1
        return 0
      }).map(label => ({
        label,
        query: `search:${label}`,
      }))

      const savedSearches = [all, ...sortedLabelObjs]

      commit(booru.SavedSearches, savedSearches)
    } else {
      throw new Error(res.error.message)
    }
  },
}
