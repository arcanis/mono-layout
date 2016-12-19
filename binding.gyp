{
    "targets": [ {

	"includes": [
	    "auto.gypi",
            "final-flags.gypi"
	],

	"sources": [
	    "sources/nbind.cc",
            "sources/LineSizeContainer.cc",
	    "sources/TextLayout.cc"
	],

        "cflags": [
            "-DNBIND"
        ]

    } ],

    "includes": [
	"auto-top.gypi"
    ]
}
