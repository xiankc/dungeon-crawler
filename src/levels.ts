import { Level } from './types';

export const LEVELS: Level[] = [
  {
    name: "The Ruined Crypts",
    description: "Learn the basics: Move with A/D or Arrow keys, jump with W, Space, or Up. Collect the key to slide open the locked gate, and exit through the golden portal!",
    grid: [
      "########################################",
      "#                                      #",
      "#                                      #",
      "#                                      #",
      "#                                      #",
      "#            C           C             #",
      "#          #####       #####           #",
      "#                                      #",
      "#                                      #",
      "#      P           K            D   X  #",
      "########### SSSS ####### SSSS ##########",
      "###########      #######      ##########",
      "########################################"
    ],
    movingPlatforms: []
  },
  {
    name: "Vestibule of Hazards",
    description: "Dodge the spikes, trigger the green-glowing checkpoint, and leap onto floating moving platforms to find the key and unlock the exit path.",
    grid: [
      "############################################################",
      "#                                                          #",
      "#                                                          #",
      "#                      C                                   #",
      "#      C            ########                               #",
      "#     ####                                                 #",
      "#                                                          #",
      "#             G                                            #",
      "#           #####                                     X    #",
      "#                                                     #    #",
      "#                                       K            ###   #",
      "#                                                    ###   #",
      "#        P                                    D      ###   #",
      "##################### SSSSSSSS ############ SSS #############",
      "#####################          ############     ############",
      "############################################################"
    ],
    movingPlatforms: [
      {
        id: "p1",
        width: 64, // 2 tiles wide
        height: 16,
        startX: 700,
        startY: 300,
        endX: 1100,
        endY: 300,
        speed: 2.2
      },
      {
        id: "p2",
        width: 80, // 2.5 tiles wide
        height: 16,
        startX: 1200,
        startY: 400,
        endX: 1200,
        endY: 200,
        speed: 1.8
      }
    ]
  },
  {
    name: "The Magma Keep",
    description: "The ultimate trial! Ride moving platforms above deadly lava torrents, jump precisely across thin ledges, and unlock your passage out of this burning fortress.",
    grid: [
      "################################################################################",
      "#                                                                              #",
      "#                                                                              #",
      "#                     C                        C                               #",
      "#       C           #####                     ###                              #",
      "#      ###                                   #####                             #",
      "#                                                                              #",
      "#                                                                              #",
      "#              G                                            K                  #",
      "#             ###                                          ###                 #",
      "#                                                         #####                #",
      "#                                                                              #",
      "#                                                                              #",
      "#                                                                              #",
      "#                                      C                                       #",
      "#     P                               ###                     D         X      #",
      "########### LLLLLLLLLLLLLLL ######### LLLLLLLLLLLLLLL ####### SSS ##############",
      "###########                 #########                 #######     ##############",
      "################################################################################"
    ],
    movingPlatforms: [
      {
        id: "m1",
        width: 80,
        height: 16,
        startX: 380,
        startY: 440,
        endX: 740,
        endY: 440,
        speed: 2.5
      },
      {
        id: "m2",
        width: 80,
        height: 16,
        startX: 980,
        startY: 440,
        endX: 1340,
        endY: 440,
        speed: 3.0
      }
    ]
  }
];
