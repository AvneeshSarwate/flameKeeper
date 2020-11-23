fix svg transform so the canvas can scale xy independently and not come appart

figure out bottom clipping
- fix timing of when after resize the resize is called
- figure out what thing to pull size from to calculate drawing resize 
- see why 3:2 ratio of installation is not necessarily preserved after returning from full screen

bottom clipping cause:
- when fullscreening, canvas is scaled up by the min of x/y upscale. But AFTER the canvas is scaled up in resolution, it is again scaled up by css width 100%. That results in the width filling up the full screen, but then the bottom being cut off, because the css causes the height to be scaled the same as the width, and now the height ratio for the canvas is higher than that of the screen. So, we need to not stretch the width of the canvas with CSS on fullscreen (and also center it in the extra space that now exists horizontally);