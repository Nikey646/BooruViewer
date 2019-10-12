using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using AutoMapper;
using BooruViewer.Models;
using BooruViewer.Models.Danbooru;
using BooruViewer.Models.Response;
using BooruViewer.Models.Response.AutoComplete;
using BooruViewer.Models.Response.Posts;
using BooruViewer.Refit;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Refit;

namespace BooruViewer.Controllers.Api.Danbooru
{
    public abstract class AbstractDanbooruController : BooruController
    {
        private readonly IDanbooruApi _api;
        private readonly IMapper _mapper;

        protected readonly IDataProtector DataProtector;
        protected abstract SourceBooru SourceBooru { get; }
        protected abstract String CookieName { get;  }
        protected abstract String BaseDomain { get; }

        protected AbstractDanbooruController(IDanbooruApi api, IMapper mapper, IDataProtectionProvider dataProtectorProvider)
        {
            this._api = api;
            this._mapper = mapper;
            this.DataProtector = dataProtectorProvider.CreateProtector("danbooru-api-details");
        }

        [HttpGet("posts")]
        public override async Task<JsonResult> PostsAsync(String tags, Int64 page, Int64 limit)
        {
            if (page < 1)
                return this.Json(new ResponseDto<ResponseErrorMessage>(false,
                    new ResponseErrorMessage("Page cannot be 0 or negative.")));
            if (limit < 1)
                return this.Json(new ResponseDto<ResponseErrorMessage>(false,
                    new ResponseErrorMessage("Limit cannot be 0 or negative.")));

            ICollection<Post> posts;
            try
            {
                posts = await this._api.GetPostsAsync(tags, page, limit, this.GetAuthenticationHeader());
            }
            catch (ApiException crap)
            {
                if (!crap.HasContent)
                    throw;

                var error = await crap.GetContentAsAsync<Request>();

                return this.Json(new ResponseDto<ResponseErrorMessage>(false,
                    new ResponseErrorMessage(
                        $"Proxy request to danbooru failed.{Environment.NewLine}" +
                        $"Reason: {error.Message}{Environment.NewLine}" +
                        $"Stacktrace: {String.Join(Environment.NewLine, error.Backtrace)}")));
            }

            // TODO: Order tags!

            var postDtos = this._mapper.Map<IEnumerable<PostDto>>(posts);
            var response = new ResponseDto<PostsResponseDto>(true, new PostsResponseDto(this.SourceBooru, postDtos));
            return this.Json(response);
        }

        [HttpGet("autocomplete")]
        public override async Task<JsonResult> AutocompleteAsync(String tag)
        {
            AutoComplete[] autoComplete;
            try
            {
                autoComplete = await this._api.GetAutocompleteAsync(tag, limit: 7, authorization: this.GetAuthenticationHeader());
            }
            catch (ApiException crap)
            {
                if (!crap.HasContent)
                    throw;

                var error = await crap.GetContentAsAsync<Request>();

                return this.Json(new ResponseDto<ResponseErrorMessage>(false,
                    new ResponseErrorMessage(
                        $"Proxy request to danbooru failed.{Environment.NewLine}" +
                        $"Reason: {error.Message}{Environment.NewLine}" +
                        $"Stacktrace: {String.Join(Environment.NewLine, error.Backtrace)}")));
            }

            var response = new ResponseDto<IEnumerable<AutoCompleteDto>>(true,
                this._mapper.Map<IEnumerable<AutoCompleteDto>>(autoComplete));
            return this.Json(response);
        }

        [HttpGet("auth")]
        public override Task<JsonResult> Authenticate(String username, String password)
        {
            // TODO: Test Username + Password to ensure they work.
            // Waiting on /profile and /settings endpoints, https://discordapp.com/channels/310432830138089472/310846683376517121/617772741000429704
            var expiration = DateTimeOffset.UtcNow.AddDays(7);
            this.Response.Cookies.Append(this.CookieName, this.DataProtector.Protect($"{username}:{password}"),
                new CookieOptions()
                {
                    Expires = expiration,
                    HttpOnly = true,
                    IsEssential = true,
                    Path = "/",
                });

            return Task.FromResult(this.Json(new ResponseDto<Int64>(true, expiration.ToUnixTimeSeconds())));
        }

        [HttpGet("favorites/add/{postId}")]
        public async Task<JsonResult> AddFavorite(UInt64 postId)
        {
            try
            {
                var post = await this._api.AddFavorite(postId, this.GetAuthenticationHeader());
                return this.Json(new ResponseDto<Object>(true, null));
            }
            catch (ApiException crap)
            {
                if (!crap.HasContent)
                    throw;

                var error = await crap.GetContentAsAsync<Request>();
                if (error.Message == "You have already favorited this post")
                    return this.Json(new ResponseDto<Object>(true, null));

                return this.Json(new ResponseDto<ResponseErrorMessage>(false, new ResponseErrorMessage(
                    $"Proxy request to danbooru failed.{Environment.NewLine}" +
                    $"Reason: {error.Message}{Environment.NewLine}" +
                    $"Stacktrace: {String.Join(Environment.NewLine, error.Backtrace)}")));
            }
        }

        [HttpGet("favorites/remove/{postId}")]
        public async Task<JsonResult> RemoveFavorite(UInt64 postId)
        {
            try
            {
                await this._api.RemoveFavorite(postId, this.GetAuthenticationHeader());
                return this.Json(new ResponseDto<Object>(true, null));
            }
            catch (ApiException)
            {
                return this.Json(new ResponseDto<ResponseErrorMessage>(false, new ResponseErrorMessage(
                    $"Proxy request to danbooru failed.{Environment.NewLine}" +
                    $"Reason: Unexpected ApiException Occured.")));
            }
        }

        [HttpGet("notes/{postId}")]
        public async Task<JsonResult> GetNotesById(UInt64 postId)
        {
            try
            {
                var notes = await this._api.GetNotesByIdAsync(postId);
                return this.Json(new ResponseDto<NoteDto[]>(true, this._mapper.Map<NoteDto[]>(notes)));
            }
            catch (ApiException crap)
            {
                if (!crap.HasContent)
                    throw;

                var error = await crap.GetContentAsAsync<Request>();

                return this.Json(new ResponseDto<ResponseErrorMessage>(false,
                    new ResponseErrorMessage(
                        $"Proxy request to danbooru failed.{Environment.NewLine}" +
                        $"Reason: {error.Message}{Environment.NewLine}" +
                        $"Stacktrace: {String.Join(Environment.NewLine, error.Backtrace)}")));
            }
        }

        [HttpGet("image/{parts}")]
        public override async Task<FileResult> ImageAsync(String parts)
        {
            var splitParts = parts.Split(':');
            var domain = splitParts[0];
            var path = String.Join('/', splitParts.Skip(1));

            // :(
            var tmpClient = RestService.For<IDanbooruApi>($"https://{domain}.{this.BaseDomain}/");
            var response = await tmpClient.GetImageAsync(path);

            return this.File(await response.ReadAsStreamAsync(), response.Headers.ContentType.MediaType);
        }

        protected virtual String GetAuthenticationHeader()
        {
            if (!this.Request.Cookies.ContainsKey(this.CookieName))
                return null;

            // Fail fast if it exists and doesn't decrypt
            var danbooruCookie = this.Request.Cookies[this.CookieName];
            var authData = this.DataProtector.Unprotect(danbooruCookie);

            String Base64(String data)
            {
                var bytes = Encoding.UTF8.GetBytes(data);
                return Convert.ToBase64String(bytes, 0, bytes.Length);
            }

            return $"Basic {Base64(authData)}";
        }
    }
}
