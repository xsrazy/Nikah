import { util } from './util.js';
import { like } from './like.js';
import { guest } from './guest.js';
import { theme } from './theme.js';
import { audio } from './audio.js';
import { offline } from './offline.js';
import { comment } from './comment.js';
import { progress } from './progress.js';
import { pagination } from './pagination.js';

document.addEventListener('DOMContentLoaded', () => {
    // Assign the globals first and isolate every init (audit fix): one
    // failing module or CDN script must never disable the whole page.
    window.like = like;
    window.util = util;
    window.guest = guest;
    window.theme = theme;
    window.audio = audio;
    window.comment = comment;
    window.pagination = pagination;

    const safeInit = (fn) => {
        try {
            fn();
        } catch (err) {
            console.error(err);
        }
    };

    safeInit(() => theme.init());
    safeInit(() => audio.init());
    safeInit(() => guest.init());
    safeInit(() => offline.init());
    safeInit(() => progress.init());
    safeInit(() => pagination.init());
    safeInit(() => {
        if (window.AOS) {
            window.AOS.init();
        }
    });
});
