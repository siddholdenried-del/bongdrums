#include <stdio.h>
void bd_init(void),bd_start(void),bd_render(int n),bd_dry(int v);
float *bd_left(void),*bd_right(void);
int main(void){FILE *f=fopen("native.tmp","wb"); if(!f)return 2; for(int wet=0;wet<2;wet++){
  bd_init(); bd_dry(!wet); bd_start();
  for(int i=0;i<720;i++){bd_render(128);fwrite(bd_left(),sizeof(float),128,f);fwrite(bd_right(),sizeof(float),128,f);}
} return fclose(f);}
