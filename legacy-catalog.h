/* Browser compatibility: immutable v0.4.8 IDs, labels and control ticks. */
typedef struct { const char *name; int ticks[8]; } LegacyRecipe;
static const LegacyRecipe old_1[] = {
    {"808 Round", {520, 1500, 110, 50, 160, 680, 0, 0}},
    {"909 Punch", {530, 880, 280, 140, 540, 820, 0, 0}},
    {"Short Thump", {620, 300, 75, 30, 300, 480, 0, 0}},
    {"Sub Boom", {370, 2050, 50, 100, 80, 260, 0, 0}},
    {"Hard Knock", {700, 470, 185, 80, 860, 940, 0, 0}},
    {"Laser Kick", {460, 720, 345, 580, 350, 590, 0, 0}},
};
static const LegacyRecipe old_2[] = {
    {"808 Snare", {0, 470, 550, 600, 460, 0, 0}},
    {"909 Snare", {1, 520, 600, 740, 620, 0, 0}},
    {"Dry Rim", {2, 750, 290, 250, 720, 0, 0}},
    {"Wire Snap", {0, 680, 400, 900, 840, 0, 0}},
    {"Deep Shell", {1, 240, 900, 580, 290, 0, 0}},
};
static const LegacyRecipe old_3[] = {
    {"808 Clap", {0, 460, 540, 480, 0, 0}},
    {"909 Clap", {1, 520, 670, 550, 0, 0}},
    {"Dry Hands", {2, 180, 390, 120, 0, 0}},
    {"Wide Room", {0, 860, 490, 910, 0, 0}},
};
static const LegacyRecipe old_4[] = {
    {"Round Tom", {0, 500, 500, 480, 0, 0}},
    {"Hard Tom", {1, 550, 490, 670, 0, 0}},
    {"Short Wood", {0, 720, 140, 840, 0, 0}},
    {"Deep Skin", {0, 250, 910, 210, 0, 0}},
};
static const LegacyRecipe old_5[] = {
    {"Round Tom", {0, 500, 500, 480, 0, 0}},
    {"Hard Tom", {1, 550, 490, 670, 0, 0}},
    {"Short Wood", {0, 720, 140, 840, 0, 0}},
    {"Deep Skin", {0, 250, 910, 210, 0, 0}},
};
static const LegacyRecipe old_6[] = {
    {"Round Tom", {0, 500, 500, 480, 0, 0}},
    {"Hard Tom", {1, 550, 490, 670, 0, 0}},
    {"Short Wood", {0, 720, 140, 840, 0, 0}},
    {"Deep Skin", {0, 250, 910, 210, 0, 0}},
};
static const LegacyRecipe old_7[] = {
    {"Closed Hat", {0, 500, 500, 0, 0}},
    {"Tight Tick", {1, 160, 720, 0, 0}},
    {"Dark Chick", {0, 370, 180, 0, 0}},
    {"Loose Hat", {1, 830, 580, 0, 0}},
};
static const LegacyRecipe old_8[] = {
    {"Open Hat", {0, 500, 500, 0, 0}},
    {"Short Sizzle", {1, 220, 790, 0, 0}},
    {"Dark Wash", {0, 810, 220, 0, 0}},
    {"Long Shimmer", {1, 920, 700, 0, 0}},
};
static const LegacyRecipe old_9[] = {
    {"Crash", {0, 0, 500, 500, 0, 0}},
    {"Ride", {1, 0, 500, 500, 0, 0}},
    {"Riser", {2, 1, 760, 730, 0, 0}},
    {"Noise Drop", {3, 0, 650, 420, 0, 0}},
    {"Dark Crash", {0, 0, 840, 220, 0, 0}},
    {"Bright Ride", {1, 1, 350, 840, 0, 0}},
};
static const LegacyRecipe old_10[] = {
    {"Electro Zap", {0, 590, 440, 780, -880, 820, 0, 0}},
    {"FM Block", {1, 420, 350, 640, -350, 640, 0, 0}},
    {"Twin Bell", {2, 760, 560, 800, 0, 500, 0, 0}},
    {"Velocity Tom", {3, 330, 530, 520, 0, 500, 0, 0}},
    {"Metal Sheet", {4, 680, 420, 550, 180, 500, 0, 0}},
    {"Noise Brush", {5, 460, 780, 680, 0, 500, 0, 0}},
    {"Round Bongo", {0, 290, 610, 370, -150, 560, 0, 0}},
    {"High Ping", {1, 840, 260, 780, 280, 830, 0, 0}},
};
static const LegacyRecipe old_11[] = {
    {"Metal Sheet", {4, 680, 420, 550, 180, 500, 0, 0}},
    {"FM Block", {1, 420, 350, 640, -350, 640, 0, 0}},
    {"Twin Bell", {2, 760, 560, 800, 0, 500, 0, 0}},
    {"Velocity Tom", {3, 330, 530, 520, 0, 500, 0, 0}},
    {"Electro Zap", {0, 590, 440, 780, -880, 820, 0, 0}},
    {"Noise Brush", {5, 460, 780, 680, 0, 500, 0, 0}},
    {"Round Bongo", {0, 290, 610, 370, -150, 560, 0, 0}},
    {"High Ping", {1, 840, 260, 780, 280, 830, 0, 0}},
};
static const LegacyRecipe *const legacy[] = {old_1, old_2, old_3, old_4, old_5, old_6, old_7, old_8, old_9, old_10, old_11};
static const int old_count[] = {6, 5, 4, 4, 4, 4, 4, 4, 6, 8, 8};
static const int old_params[] = {8, 7, 6, 6, 6, 6, 5, 5, 6, 8, 8};
