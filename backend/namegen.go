package main

import (
	"fmt"
	"math/rand"

	"golang.org/x/text/cases"
	"golang.org/x/text/language"
)

var colors = []string{
	"red", "orange", "yellow", "green", "blue", "purple", "violet", "indigo",
	"pink", "brown", "black", "white", "gray", "silver", "gold", "bronze",
	"crimson", "scarlet", "vermilion", "amber", "ochre", "lemon", "lime",
	"emerald", "teal", "cyan", "azure", "navy", "sapphire", "cobalt",
	"lavender", "lilac", "magenta", "maroon", "burgundy", "rose", "coral",
	"peach", "apricot", "beige", "cream", "ivory", "charcoal", "ebony",
	"golden", "silvery", "copper", "brass", "russet", "umber", "sepia",
	"turquoise", "aqua", "jade", "olive", "mustard", "honey", "salmon",
	"tangerine", "plum", "mauve", "wine", "ruby", "garnet", "amethyst",
	"topaz", "pearl", "opal", "jet", "onyx",
}

var animals = []string{
	"ape", "baboon", "badger", "bat", "bear", "beaver", "bison", "boar",
	"buffalo", "camel", "cat", "cheetah", "chimpanzee", "cow", "coyote",
	"crocodile", "deer", "dog", "dolphin", "donkey", "elephant", "elk",
	"ferret", "fox", "frog", "gazelle", "giraffe", "goat", "gorilla",
	"hamster", "hare", "hedgehog", "hippopotamus", "horse", "hyena",
	"jaguar", "kangaroo", "koala", "leopard", "lion", "llama", "lynx",
	"mole", "mongoose", "monkey", "moose", "mouse", "otter", "panda",
	"panther", "pig", "platypus", "porcupine", "possum", "rabbit", "raccoon",
	"rat", "rhinoceros", "seal", "sheep", "skunk", "sloth", "snake",
	"squirrel", "tiger", "walrus", "weasel", "wolf", "wolverine", "zebra",
	"alligator", "antelope", "armadillo", "beetle", "butterfly", "caterpillar",
	"centipede", "crab", "eagle", "falcon", "hawk", "owl", "parrot",
	"peacock", "penguin", "robin", "seagull", "sparrow", "swan", "turtle",
	"tortoise", "woodpecker", "worm", "alpaca", "caribou", "chinchilla",
	"duck", "flamingo", "gecko", "iguana", "lemur", "llama", "meerkat",
	"narwhal", "octopus", "puma", "quokka", "reindeer", "shark", "toucan",
	"urchin", "vulture", "wombat", "yak",
}

func toTitle(s string) string {
	return cases.Title(language.English, cases.Compact).String(s)
}

func generateName() string {
	color := toTitle(colors[rand.Intn(len(colors))])
	animal := toTitle(animals[rand.Intn(len(animals))])
	return fmt.Sprintf("%s %s", color, animal)
}
